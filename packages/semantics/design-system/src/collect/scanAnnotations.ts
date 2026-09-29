import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import type { ImplementsAnnotation } from "./types.js";

/**
 * Regex to match @implements annotations in source files
 * Supports formats:
 *   @implements ds:global.component.button
 *   @implements ds:global.component.button@1.0.0
 *   @implements ds:global.component.button [draft]
 *   @implements ds:global.component.button@1.0.0 [draft]
 *   @implements ds:global.subcomponent.tile-header (with hyphens)
 *
 * Captures:
 *   [1] full prefixed URI (e.g., "ds:global.component.button")
 *   [2] optional version suffix (e.g., "1.0.0")
 */
const IMPLEMENTS_REGEX =
  /@implements\s+([a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_.:-]+)(?:@(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?))?(?:\s+\[draft\])?/g;

/**
 * Check if annotation line contains [draft] marker
 */
function isDraftAnnotation(line: string): boolean {
  return /\[draft\]/i.test(line);
}

/**
 * Scan a single file for @implements annotations
 */
async function scanFile(filePath: string): Promise<ImplementsAnnotation[]> {
  const content = await readFile(filePath, "utf-8");
  const annotations: ImplementsAnnotation[] = [];

  let match: RegExpExecArray | null = IMPLEMENTS_REGEX.exec(content);
  while (match !== null) {
    const fullMatch = match[0];
    const blockUri = match[1];
    const version = match[2];
    const isDraft = isDraftAnnotation(fullMatch);

    // Extract prefix from blockUri (e.g., "ds" from "ds:global.component.button")
    const colonIndex = blockUri.indexOf(":");
    const prefix = colonIndex > 0 ? blockUri.slice(0, colonIndex) : undefined;

    annotations.push({
      filePath,
      blockUri,
      version,
      isDraft,
      prefix,
    });
    match = IMPLEMENTS_REGEX.exec(content);
  }

  // Reset regex state
  IMPLEMENTS_REGEX.lastIndex = 0;

  return annotations;
}

/**
 * Scan files matching a glob pattern for @implements annotations
 * @param pattern - Glob pattern (e.g., "src/**\/*.tsx")
 * @param cwd - Working directory for glob resolution
 */
export default async function scanAnnotations(
  pattern: string,
  cwd: string,
): Promise<ImplementsAnnotation[]> {
  const files = await glob(pattern, { cwd, absolute: true });
  const allAnnotations: ImplementsAnnotation[] = [];

  for (const file of files) {
    const annotations = await scanFile(file);
    allAnnotations.push(...annotations);
  }

  return allAnnotations;
}

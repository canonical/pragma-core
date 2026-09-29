/**
 * Modifier file I/O — read DTCG source files for their `$description` text.
 *
 * Performs synchronous file I/O via `readFileSync`. Called during the build
 * to recover the `$description` text a context authored, which the resolved
 * token graph does not carry per-context.
 */
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Data extracted from a DTCG modifier source file.
 *
 * Descriptions only. The alias map that lived here answered "did this context
 * override that token", which the resolver's own `aliasChain` now answers
 * without re-reading the source.
 */
export interface ModifierFileData {
  descriptions: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Walk a DTCG token JSON tree and collect `$description` values, keyed by the
 * dot-separated token ID path.
 *
 * @note Performs synchronous file I/O (readFileSync).
 */
export function extractModifierFileData(filePath: string): ModifierFileData {
  const descriptions: Record<string, string> = {};
  try {
    const raw = readFileSync(filePath, "utf8");
    const json = JSON.parse(raw);
    walkTokenTree(json, [], descriptions);
  } catch (err) {
    console.warn(
      `[canonical-css] Could not read modifier data from ${filePath}:`,
      err instanceof Error ? err.message : err,
    );
  }
  return { descriptions };
}

/**
 * Recursively walk a DTCG token tree, collecting `$description` values.
 *
 * When `$root` is encountered, the token ID is the parent path (the `$root`
 * marker is stripped per DTCG spec).
 *
 * This used to collect alias targets too, so that `computeModifierContext`
 * could tell an override from an inheritance. It reads the resolver's own
 * `aliasChain` for that now, and nothing needs the raw JSON to answer it.
 */
export function walkTokenTree(
  node: unknown,
  path: string[],
  descriptions: Record<string, string>,
): void {
  if (typeof node !== "object" || node === null) return;
  const obj = node as Record<string, unknown>;

  // Collect $description at this level (only for token nodes with $value)
  if (
    "$value" in obj &&
    "$description" in obj &&
    typeof obj.$description === "string"
  ) {
    const tokenId = path.join(".");
    descriptions[tokenId] = obj.$description;
  }

  // Recurse into children (skip $-prefixed keys except $root)
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$root") {
      // $root collapses to the parent path
      walkTokenTree(value, path, descriptions);
    } else if (!key.startsWith("$")) {
      walkTokenTree(value, [...path, key], descriptions);
    }
  }
}

/**
 * Load modifier file data for a specific family context by reading the raw
 * token source files referenced in the resolver JSON.
 *
 * Returns the description map (token ID → `$description` text).

 *
 * @note Performs synchronous file I/O (readFileSync + JSON.parse on the resolver).
 * @param tokensDir  - Base directory for token sources (e.g. "./tokens/canonical")
 * @param family     - Modifier family name (e.g. "anticipation")
 * @param context    - Context name (e.g. "constructive")
 */
export function loadModifierData(
  tokensDir: string,
  family: string,
  context: string,
): ModifierFileData {
  // Read the resolver JSON to find the $ref paths for this context
  const resolverPath = `${tokensDir}/canonical.resolver.json`;
  try {
    const resolverJson = JSON.parse(readFileSync(resolverPath, "utf8"));
    const refs: Array<{ $ref?: string }> =
      resolverJson.modifiers?.[family]?.contexts?.[context] ?? [];
    const descriptions: Record<string, string> = {};
    for (const ref of refs) {
      if (ref.$ref) {
        const filePath = `${tokensDir}/${ref.$ref}`;
        const data = extractModifierFileData(filePath);
        Object.assign(descriptions, data.descriptions);
      }
    }
    return { descriptions };
  } catch (err) {
    console.warn(
      `[canonical-css] Could not load modifier data for ${family}/${context}:`,
      err instanceof Error ? err.message : err,
    );
    return { descriptions: {} };
  }
}

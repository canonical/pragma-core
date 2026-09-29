import { Writer } from "n3";
import type { GraphStore } from "../graph/index.js";
import type { SerializeOptions } from "./types.js";

/**
 * Compact full URIs to prefixed form in Turtle output
 * Handles URIs with slashes that n3 won't auto-compact
 */
function compactUris(turtle: string, prefixes: Record<string, string>): string {
  let result = turtle;
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    // Replace <namespace...> with prefix:...
    const regex = new RegExp(`<${escapeRegex(namespace)}([^>]+)>`, "g");
    // A replacer function, for the same reason as in inlineBlankNodes:
    // never let interpolated text be read as a substitution pattern.
    result = result.replace(
      regex,
      (_match, localName: string) => `${prefix}:${localName}`,
    );
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert named blank nodes to inline anonymous syntax
 * Transforms: `ds:hasProperty _:n3-0.` + `_:n3-0 a ds:Property; ...`
 * Into: `ds:hasProperty [ a ds:Property; ... ]`
 */
function inlineBlankNodes(turtle: string): string {
  // Find all blank node definitions (blocks starting with _:... and ending with .)
  // Pattern matches: _:id followed by content until a line ending with just "."
  const bnPattern = /^(_:[\w-]+)\s+([\s\S]*?)\.\n/gm;
  const blankNodes = new Map<string, string>();

  let match: RegExpExecArray | null = bnPattern.exec(turtle);
  while (match !== null) {
    const bnId = match[1];
    const content = match[2].trim();
    // Format for inline: wrap in brackets with proper indentation
    const indentedContent = content.replace(/\n\s+/g, "\n        ");
    blankNodes.set(bnId, `[\n        ${indentedContent}\n    ]`);
    match = bnPattern.exec(turtle);
  }

  if (blankNodes.size === 0) {
    return turtle;
  }

  let result = turtle;

  // Replace references to blank nodes with inline syntax
  for (const [bnId, inlineContent] of blankNodes) {
    // Replace references like "_:n3-0" or "_:n3-0," or "_:n3-0."
    //
    // The replacement MUST be a function. `inlineContent` is authored data
    // (property constraints, usage guidance), and in a replacement *string*
    // a dollar sign starts a substitution pattern: dollar-ampersand is the
    // match, dollar-backtick everything before it, dollar-quote everything
    // after, dollar-1 a capture group. One property documenting a Yup schema
    // quoted a regex ending in a dollar sign followed by a backtick, so the
    // whole preceding document was spliced into the middle of that literal,
    // leaving it unterminated and the file unparseable — which made
    // `pragma sources update` refuse an entire pack over one row.
    result = result.replace(
      new RegExp(`${escapeRegex(bnId)}([,.;])`, "g"),
      (_match, punctuation: string) => `${inlineContent}${punctuation}`,
    );
    // Remove the standalone blank node definition block
    result = result.replace(
      new RegExp(`^${escapeRegex(bnId)}\\s+[\\s\\S]*?\\.\n`, "gm"),
      "",
    );
  }

  return `${result.trim()}\n`;
}

/**
 * Serialize a GraphStore to Turtle format
 *
 * Uses n3 Writer for proper Turtle formatting with:
 * - Prefix declarations
 * - Grouped statements by subject with semicolons
 * - Proper indentation
 */
export default function serializeToTurtle(
  store: GraphStore,
  options: SerializeOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const quads = store.getQuads();

    if (quads.length === 0) {
      resolve("");
      return;
    }

    const writer = new Writer({
      prefixes: options.prefixes.toRecord(),
    });

    for (const quad of quads) {
      writer.addQuad(quad);
    }

    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        // Post-process: compact URIs and inline blank nodes
        let processed = compactUris(result, options.prefixes.toRecord());
        processed = inlineBlankNodes(processed);
        resolve(processed);
      }
    });
  });
}

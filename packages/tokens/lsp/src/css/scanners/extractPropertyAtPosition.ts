/**
 * Extract the CSS property name at a cursor position.
 *
 * Given a source document and a cursor position inside a `var()` context,
 * walk backwards on the current line to find the CSS property name that
 * contains this value.
 *
 * @example
 *   extractPropertyAtPosition("  padding-left: var(--x);", { line: 0, character: 22 })
 *   // => "padding-left"
 */
import type { Position } from "../../types/index.js";

/** Pattern: `property-name :` with optional whitespace. */
const PROPERTY_RE = /([\w-]+)\s*:/;

/**
 * Extract the CSS property name from the line at `position`.
 *
 * Returns `null` when the cursor is not in a property-value context
 * (for example inside a selector, at-rule, or comment).
 */
export default function extractPropertyAtPosition(
  source: string,
  position: Position,
): string | null {
  const lines = source.split("\n");
  const line = lines[position.line];
  if (!line) return null;

  const before = line.substring(0, position.character);
  // Restrict the search to the current declaration: the text after the most
  // recent statement boundary on this line. Without this, a multi-declaration
  // line like `margin: 0; color: var(--q)` returns the *leftmost* property
  // (`margin`) regardless of where the cursor is.
  const boundary = Math.max(
    before.lastIndexOf(";"),
    before.lastIndexOf("{"),
    before.lastIndexOf("}"),
  );
  const segment = before.slice(boundary + 1);
  const match = segment.match(PROPERTY_RE);
  if (!match) return null;

  const property = match[1];
  if (property.startsWith("-")) return null;

  return property;
}

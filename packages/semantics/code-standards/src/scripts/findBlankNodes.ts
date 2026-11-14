import findOutside from "./findOutside.js";
import type { Found } from "./types.js";

const BRACKET = /[[\]]/;

/**
 * Returns the span inside the brackets of each `predicate [ … ]` blank node
 * in `block`. Throws on one left open.
 */
export default function findBlankNodes(
  block: string,
  predicate: string,
): Found[] {
  const opening = new RegExp(`${predicate}\\s*\\[`);
  const nodes: Found[] = [];
  let found = findOutside(block, opening);

  while (found !== null) {
    let depth = 1;
    let end = found.end;
    while (depth > 0) {
      const bracket = findOutside(block, BRACKET, end);
      if (bracket === null) {
        throw new Error(`Unclosed ${predicate} example`);
      }
      depth += bracket.text === "[" ? 1 : -1;
      end = bracket.end;
    }
    nodes.push({
      index: found.end,
      end: end - 1,
      text: block.slice(found.end, end - 1),
    });
    found = findOutside(block, opening, end);
  }

  return nodes;
}

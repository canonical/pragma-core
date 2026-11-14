import findBlankNodes from "./findBlankNodes.js";
import readLiteral from "./readLiteral.js";
import type { Example } from "./types.js";

/** Returns the `cs:do` or `cs:dont` examples of a standard's block. */
export default function parseExamples(
  block: string,
  predicate: "cs:do" | "cs:dont",
): Example[] {
  return findBlankNodes(block, predicate).map(({ text }) => ({
    description: readLiteral(text, "cs:description"),
    language: readLiteral(text, "cs:language"),
    code: readLiteral(text, "cs:code"),
  }));
}

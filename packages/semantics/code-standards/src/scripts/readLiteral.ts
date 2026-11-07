import decodeEscapes from "./decodeEscapes.js";
import findLiteralEnd from "./findLiteralEnd.js";
import findOutside from "./findOutside.js";

/** What may follow a literal: the end of a part, a tag, a datatype or a comment. */
const AFTER_LITERAL = /^\s*(?:[;.,\]@^#]|$)/;

/**
 * Returns the decoded, trimmed literal of the first `predicate` outside a
 * literal, or an empty string. Throws when it is unterminated or a stray
 * token follows it.
 */
export default function readLiteral(
  content: string,
  predicate: string,
): string {
  const escaped = predicate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = findOutside(content, new RegExp(`(?<![\\w:.-])${escaped}\\s+`));
  if (found === null) {
    return "";
  }

  const opening = content.charAt(found.end);
  if (opening !== '"' && opening !== "'") {
    return "";
  }

  const literal = findLiteralEnd(content, found.end);
  const rest = content.slice(literal.end);
  if (!AFTER_LITERAL.test(rest)) {
    const next = rest.trimStart().charAt(0);
    throw new Error(`Unexpected "${next}" after the ${predicate} literal`);
  }

  return decodeEscapes(literal.raw).trim();
}

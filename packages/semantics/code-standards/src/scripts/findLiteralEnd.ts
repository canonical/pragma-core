/**
 * Returns the raw content of the Turtle literal opening at `start`, in any
 * quoted form, and the index after its closing quotes. Throws when it is
 * unterminated.
 */
export default function findLiteralEnd(
  content: string,
  start: number,
): { readonly raw: string; readonly end: number } {
  const quote = content.charAt(start);
  const long = content.startsWith(quote.repeat(3), start);
  const open = long ? 3 : 1;
  let index = start + open;

  while (index < content.length) {
    const char = content.charAt(index);

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (!long && char === "\n") {
      break;
    }

    if (long ? content.startsWith(quote.repeat(3), index) : char === quote) {
      let close = index;
      while (long && content.charAt(close + 3) === quote && close - index < 2) {
        close += 1;
      }
      return { raw: content.slice(start + open, close), end: close + open };
    }

    index += 1;
  }

  throw new Error("Unterminated literal");
}

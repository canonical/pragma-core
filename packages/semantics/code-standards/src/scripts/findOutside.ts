import findLiteralEnd from "./findLiteralEnd.js";
import type { Found } from "./types.js";

/**
 * Returns the first match of the sticky `pattern` at or after `from` that
 * starts outside literals, comments and IRIs, or null.
 */
export default function findOutside(
  content: string,
  pattern: RegExp,
  from = 0,
): Found | null {
  const sticky = new RegExp(
    pattern.source,
    `${pattern.flags.replace(/[gy]/g, "")}y`,
  );
  let index = from;

  while (index < content.length) {
    const char = content.charAt(index);

    if (char === '"' || char === "'") {
      index = findLiteralEnd(content, index).end;
      continue;
    }

    if (char === "#" || char === "<") {
      const close = content.indexOf(char === "#" ? "\n" : ">", index);
      index = close === -1 ? content.length : close + 1;
      continue;
    }

    sticky.lastIndex = index;
    if (sticky.test(content)) {
      return {
        index,
        end: sticky.lastIndex,
        text: content.slice(index, sticky.lastIndex),
      };
    }

    index += 1;
  }

  return null;
}

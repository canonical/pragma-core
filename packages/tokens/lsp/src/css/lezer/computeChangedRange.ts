import type { ChangedRange } from "./types.js";

export default function computeChangedRange(
  previous: string,
  next: string,
): ChangedRange | null {
  if (previous === next) return null;

  let start = 0;
  const maxPrefix = Math.min(previous.length, next.length);
  while (start < maxPrefix && previous[start] === next[start]) start++;

  let endA = previous.length;
  let endB = next.length;
  while (
    endA > start &&
    endB > start &&
    previous[endA - 1] === next[endB - 1]
  ) {
    endA--;
    endB--;
  }

  return {
    fromA: start,
    toA: endA,
    fromB: start,
    toB: endB,
  };
}

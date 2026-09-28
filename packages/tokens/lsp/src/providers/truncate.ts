/** Shared provider utilities. */

/** Truncate a string to a maximum length, appending `...` if exceeded. */
export default function truncate(s: string, max: number): string {
  return s.length > max ? `${s.substring(0, max - 3)}...` : s;
}

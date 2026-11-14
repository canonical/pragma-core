/** Returns `value`, or throws naming `what` when it is undefined. */
export default function assertDefined<T>(
  value: T | undefined,
  what: string,
): T {
  if (value === undefined) {
    throw new Error(`Missing ${what}`);
  }
  return value;
}

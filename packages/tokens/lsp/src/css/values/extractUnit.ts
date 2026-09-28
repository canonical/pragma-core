/** Extract the unit from a CSS dimension value string. */
export default function extractUnit(value: string): string | null {
  const match = value.trim().match(/^[\d.]+([a-zA-Z%]+)$/);
  return match?.[1] ?? null;
}

/**
 * Convert a Terrazzo CSS value (string or multi-value record) to a plain string.
 * Returns `null` for multi-value composites (typography).
 */
export default function convertCssValueToString(
  val: string | Record<string, string>,
): string | null {
  if (typeof val === "string") return val;
  if ("." in val) return val["."] as string; // WideGamutColorValue sRGB fallback
  return null; // multi-value (typography)
}

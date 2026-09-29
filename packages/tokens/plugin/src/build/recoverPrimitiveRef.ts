/**
 * Primitive reference recovery.
 *
 * Terrazzo resolves component-level `$ref` aliases to literal values during
 * `transformCSSValue`. This restores the semantic → primitive relationship
 * so the CSS output and artifact both reference the primitive custom property
 * instead of duplicating the raw value.
 */

/**
 * Replace a resolved literal value with a `var()` reference to the matching
 * primitive token when one exists.
 *
 * Values that are already `var()` references (whole-token aliases preserved
 * by Terrazzo) are returned unchanged. Self-references are also skipped.
 */
export function recoverPrimitiveRef(
  value: string,
  selfCssVar: string,
  primitiveByValue: Map<string, string>,
): string {
  // Already a var() reference — nothing to recover
  if (value.startsWith("var(")) return value;
  const primitiveVar = primitiveByValue.get(value);
  if (primitiveVar && primitiveVar !== selfCssVar) {
    return `var(${primitiveVar})`;
  }
  return value;
}

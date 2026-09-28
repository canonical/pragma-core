import { prefixVar } from "../../naming.js";

/**
 * Build the fallback chain for a CSS custom property, accounting for
 * modifier and surface channel overrides.
 *
 * @returns A `var()` expression with the correct fallback order.
 */
export default function buildFallbackChain(
  cssVar: string,
  hasModifier: boolean,
  hasSurface: boolean,
): string {
  const modVar = prefixVar(cssVar, "modifier");
  const surfVar = prefixVar(cssVar, "surface");

  if (hasModifier && hasSurface) {
    return `var(${modVar}, var(${surfVar}, var(${cssVar})))`;
  }
  if (hasModifier) {
    return `var(${modVar}, var(${cssVar}))`;
  }
  if (hasSurface) {
    return `var(${surfVar}, var(${cssVar}))`;
  }
  return `var(${cssVar})`;
}

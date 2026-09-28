/**
 * Build paired `light-dark()` declarations from parallel light/dark token arrays.
 *
 * Matches tokens by CSS variable name, produces a `LightDarkPair[]`
 * and generates CSS declaration nodes.
 *
 * @returns Array of CSS declaration nodes for the merged values.
 */
import createDeclaration from "../css-ast/createDeclaration.js";
import type { CSSNode } from "../css-ast/types.js";
import type { LightDarkPair } from "./types.js";
import wrapLightDark from "./wrapLightDark.js";

export default function buildLightDarkDeclarations(
  pairs: LightDarkPair[],
): CSSNode[] {
  return pairs.map((pair) =>
    createDeclaration(pair.property, wrapLightDark(pair.light, pair.dark)),
  );
}

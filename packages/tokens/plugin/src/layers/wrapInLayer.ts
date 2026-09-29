/**
 * Wrap CSS nodes in an `@layer` createRule. Returns nodes unwrapped if `layerName` is null.
 *
 * @example wrapInLayer("ds.tokens", [createDeclaration("--x", "1")]) => createRule(["@layer ds.tokens"], [...])
 * @example wrapInLayer(null, [createDeclaration("--x", "1")]) => [createDeclaration("--x", "1")]
 */
import createRule from "../css-ast/rule.js";
import type { CSSNode } from "../css-ast/types.js";

export default function wrapInLayer(
  layerName: string | null,
  children: CSSNode[],
): CSSNode[] {
  if (layerName === null) {
    return children;
  }
  return [createRule([`@layer ${layerName}`], children)];
}

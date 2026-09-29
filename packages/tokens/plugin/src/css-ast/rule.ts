/** Create a CSS rule node. */
import type { CSSNode, CSSRule } from "./types.js";

export default function createRule(
  prelude: string[],
  children: CSSNode[] = [],
): CSSRule {
  return { type: "Rule", prelude, children };
}

/**
 * Build CSS nodes for a modifier context (class selector + declarations).
 */
import createRule from "../css-ast/rule.js";
import type { CSSNode } from "../css-ast/types.js";
import type { ModifierContext } from "./types.js";

export default function buildModifierContextCSS(
  ctx: ModifierContext,
): CSSNode[] {
  if (ctx.declarations.length === 0) {
    return [];
  }
  return [createRule([ctx.selector], ctx.declarations)];
}

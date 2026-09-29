/** Check whether one CSS value type is assignable to another. */
import type { CssValueType } from "../../types/index.js";
import { SUBTYPE_RELATIONS } from "./constants.js";

export default function isAssignable(
  valueType: CssValueType,
  targetType: CssValueType,
): boolean {
  if (valueType === "<unknown>" || targetType === "<unknown>") return true;
  if (valueType === targetType) return true;
  // Walk the subtype graph transitively, e.g. <integer> → <number> →
  // <alpha-value>, so multi-hop relations are recognised, not just direct ones.
  const seen = new Set<CssValueType>([valueType]);
  const stack: CssValueType[] = [valueType];
  while (stack.length > 0) {
    const current = stack.pop() as CssValueType;
    for (const [sub, sup] of SUBTYPE_RELATIONS) {
      if (sub !== current || seen.has(sup)) continue;
      if (sup === targetType) return true;
      seen.add(sup);
      stack.push(sup);
    }
  }
  return false;
}

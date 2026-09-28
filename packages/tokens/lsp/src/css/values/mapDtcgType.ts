/** Map DTCG token types to CSS value types. */
import type { KnownDtcgTokenType } from "@canonical/token-types";
import type { CssValueType, DtcgType } from "../../types/index.js";

const DTCG_TO_CSS: ReadonlyMap<KnownDtcgTokenType, CssValueType> = new Map([
  ["color", "<color>"],
  ["number", "<number>"],
  ["fontFamily", "<family-name>"],
  ["fontWeight", "<number>"],
  ["duration", "<time>"],
  ["cubicBezier", "<easing-function>"],
  ["gradient", "<gradient>"],
  ["border", "<unknown>"],
  ["shadow", "<unknown>"],
  ["typography", "<unknown>"],
  ["transition", "<unknown>"],
  ["strokeStyle", "<unknown>"],
]);

export default function mapDtcgType(type: DtcgType | null): CssValueType {
  if (!type) return "<unknown>";
  return DTCG_TO_CSS.get(type as KnownDtcgTokenType) ?? "<unknown>";
}

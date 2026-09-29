import type { AtRuleContext, SelectorContext } from "../../types/index.js";
import classifySelectorScope from "./classifySelectorScope.js";

/** Build a full SelectorContext from a selector and its at-rule context. */
export default function buildSelectorContext(
  selector: string,
  atRules: AtRuleContext[],
): SelectorContext {
  const scopeType = classifySelectorScope(selector, atRules);
  const isGlobal = scopeType === "global" || scopeType === "universal";
  const isScoped = !isGlobal;
  return { selector, atRules, scopeType, isGlobal, isScoped };
}

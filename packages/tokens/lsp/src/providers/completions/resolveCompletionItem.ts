import type { TokenGraph } from "../../graph/index.js";
import type { CompletionItem, ResolvedConfig } from "../../types/index.js";
import { COMPLETION_OPTIONS } from "../constants.js";
import { buildTokenTooltip } from "../tokenTooltip/index.js";
import type { TooltipOptions } from "../types.js";

/**
 * Resolve a completion item by adding full documentation.
 *
 * The `label` field of the item is the CSS variable name (e.g. `--color-bg`).
 */
export default function resolveCompletionItem(
  item: CompletionItem,
  fileUri: string,
  graph: TokenGraph,
  config: ResolvedConfig,
): CompletionItem {
  if (item.documentation) return item; // Already resolved

  const cssVar = item.label;
  const options: TooltipOptions = {
    ...COMPLETION_OPTIONS,
    showProvenanceBadge: false,
    showSelectorContext: config.hover.showSelectorContext,
  };
  const docValue = buildTokenTooltip(cssVar, fileUri, graph, config, options);
  if (docValue) {
    return {
      ...item,
      documentation: { kind: "markdown" as const, value: docValue },
    };
  }
  return item;
}

import type { TokenGraph } from "../graph/index.js";
import type { MarkupContent, ResolvedConfig } from "../types/index.js";
import { HOVER_OPTIONS } from "./constants.js";
import { buildTokenTooltip } from "./tokenTooltip/index.js";
import type { TooltipOptions } from "./types.js";

/**
 * Produce a hover card for a CSS custom property.
 *
 * Delegates to `buildTokenTooltip` with full options derived from
 * the resolved hover configuration.
 */
export default function provideHover(
  cssVar: string,
  fileUri: string,
  graph: TokenGraph,
  config: ResolvedConfig,
): MarkupContent | null {
  const options: TooltipOptions = {
    ...HOVER_OPTIONS,
    showProvenanceBadge: config.hover.showProvenanceBadge,
    showSelectorContext: config.hover.showSelectorContext,
  };

  const value = buildTokenTooltip(cssVar, fileUri, graph, config, options);
  if (!value) return null;
  return { kind: "markdown", value };
}

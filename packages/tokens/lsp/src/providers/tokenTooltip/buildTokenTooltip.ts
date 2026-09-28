/**
 * Shared tooltip builder for hover cards and completion documentation.
 *
 * Produces a structured markdown string from a TokenNode. Both
 * `provideHover` and `provideCompletions` delegate here to ensure
 * consistent presentation.
 *
 * Sections are toggled by {@link TooltipOptions}: completions show a
 * compact provenance badge + description, while hover cards add the
 * resolution table, source location, and declaration-site context.
 */

import type { TokenGraph } from "../../graph/index.js";
import type { ResolvedConfig } from "../../types/index.js";
import classifyProvenance from "../classifyProvenance.js";
import type { TooltipOptions } from "../types.js";
import {
  buildResolutionTable,
  formatDeclarationSites,
  formatProvenanceLine,
} from "./index.js";

/**
 * Build a markdown tooltip for a CSS custom property.
 *
 * Used by both hover and completion documentation. The `options` parameter
 * controls which sections are included.
 */
export default function buildTokenTooltip(
  cssVar: string,
  fileUri: string,
  graph: TokenGraph,
  _config: ResolvedConfig,
  options: TooltipOptions,
): string | null {
  const provenance = classifyProvenance(cssVar, graph, fileUri);
  const token = graph.resolveToken(cssVar);
  const declarations = graph.getDeclarations(cssVar);
  const prop = graph.getProperty(cssVar);

  if (!token && declarations.length === 0 && !prop) return null;

  const sections: string[] = [];

  // ── Provenance line (identity + value in one line) ────────────
  if (options.showProvenanceBadge) {
    sections.push(
      formatProvenanceLine(provenance, token, prop, declarations, graph),
    );
  }

  // ── Description ────────────────────────────────────────────────
  if (options.showDescription && token?.description) {
    sections.push(token.description);
  }

  // ── Resolution table ──────────────────────────────────────────
  if (options.showMetadataFooter && token?.provenance.kind === "artifact") {
    const table = buildResolutionTable(token, graph);
    if (table) sections.push(table);
  }

  // ── Source location ────────────────────────────────────────────
  if (options.showMetadataFooter && token?.sourceFile) {
    const basename = token.sourceFile.split("/").pop() ?? token.sourceFile;
    const line =
      token.sourceLine !== null && token.sourceLine !== undefined
        ? `:${token.sourceLine + 1}`
        : "";
    sections.push(`\`${basename}${line}\``);
  }

  // ── Property registration detail ──────────────────────────────
  if (options.showMetadataFooter && !token && prop) {
    sections.push(
      `\`${prop.cssType}\` \u00B7 syntax: \`${prop.syntax}\` \u00B7 inherits: ${prop.inherits}`,
    );
  }

  // ── Declaration sites ─────────────────────────────────────────
  if (declarations.length > 0 && options.showSelectorContext) {
    sections.push(formatDeclarationSites(declarations));
  }

  return sections.join("\n\n");
}

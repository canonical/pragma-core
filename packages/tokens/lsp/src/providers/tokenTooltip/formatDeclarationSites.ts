import type { AtRuleContext, DeclarationNode } from "../../types/index.js";

export default function formatDeclarationSites(
  declarations: DeclarationNode[],
): string {
  const deduplicated = deduplicateDeclarations(declarations);
  const hasLayers = deduplicated.some(
    (declaration) => extractLayer(declaration.selector.atRules) !== null,
  );

  const lines: string[] = hasLayers
    ? ["| | Selector | Layer | Source |", "|:--|:---------|:------|:-------|"]
    : ["| | Selector | Source |", "|:--|:---------|:-------|"];

  for (const declaration of deduplicated) {
    const fileName =
      declaration.fileUri.split("/").pop() ?? declaration.fileUri;
    const selector = declaration.selector.selector;
    const status = declaration.selector.isGlobal ? "✓" : "";
    const atRules = formatNonLayerAtRules(declaration.selector.atRules);
    const selectorCell = atRules
      ? `\`${selector}\` \`${atRules}\``
      : `\`${selector}\``;

    if (hasLayers) {
      const layer = extractLayer(declaration.selector.atRules);
      const layerCell = layer ? `\`${layer}\`` : "";
      lines.push(
        `| ${status} | ${selectorCell} | ${layerCell} | \`${fileName}:${declaration.line + 1}\` |`,
      );
      continue;
    }

    lines.push(
      `| ${status} | ${selectorCell} | \`${fileName}:${declaration.line + 1}\` |`,
    );
  }

  return lines.join("\n");
}

function extractLayer(atRules: AtRuleContext[]): string | null {
  for (const atRule of atRules) {
    if (atRule.name === "layer") return atRule.prelude;
  }
  return null;
}

function formatNonLayerAtRules(atRules: AtRuleContext[]): string {
  const filtered = atRules.filter((atRule) => atRule.name !== "layer");
  if (filtered.length === 0) return "";
  return [...filtered]
    .reverse()
    .map((atRule) => `@${atRule.name} ${atRule.prelude}`)
    .join(" > ");
}

function deduplicateDeclarations(
  declarations: DeclarationNode[],
): DeclarationNode[] {
  const byKey = new Map<string, DeclarationNode>();
  for (const declaration of declarations) {
    const key = `${declaration.fileUri}:${declaration.line}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      declaration.selector.atRules.length > existing.selector.atRules.length
    ) {
      byKey.set(key, declaration);
    }
  }
  return [...byKey.values()];
}

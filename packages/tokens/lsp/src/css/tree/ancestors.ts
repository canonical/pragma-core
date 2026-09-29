import type { AtRuleContext } from "../../types/index.js";
import * as lezer from "../lezer/index.js";
import findLineageNode from "./lineage.js";

export function findAncestor(
  node: lezer.SyntaxNode | null,
  name: string,
): lezer.SyntaxNode | null {
  return findLineageNode(node?.parent ?? null, name);
}

export function resolveAncestorSelector(
  node: lezer.SyntaxNode,
  source: string,
): string {
  const ruleSet = findAncestor(node, "RuleSet");
  if (!ruleSet) return ":root";

  const block = ruleSet.getChild("Block");
  if (!block) return lezer.getNodeText(source, ruleSet).trim() || ":root";

  let selectorFrom = ruleSet.from;
  const previousSibling = ruleSet.prevSibling;
  if (
    previousSibling?.name === "RuleSet" &&
    !previousSibling.getChild("Block")
  ) {
    const previousText = lezer.getNodeText(source, previousSibling).trim();
    if (previousText.includes("&")) selectorFrom = previousSibling.from;
  }

  const selector = source.slice(selectorFrom, block.from).trim();
  return selector || ":root";
}

export function resolveAncestorAtRules(
  node: lezer.SyntaxNode,
  source: string,
): AtRuleContext[] {
  const contexts: AtRuleContext[] = [];
  let current = node.parent;
  while (current) {
    const context = toAtRuleContext(current, source);
    if (context) contexts.push(context);
    current = current.parent;
  }
  return contexts;
}

function toAtRuleContext(
  node: lezer.SyntaxNode,
  source: string,
): AtRuleContext | null {
  if (node.name === "RuleSet") {
    const previousSibling = node.prevSibling;
    const block = node.getChild("Block");
    const keyword = previousSibling?.getChild("AtKeyword");
    if (
      previousSibling?.name === "AtRule" &&
      keyword &&
      !previousSibling.getChild("Block") &&
      block
    ) {
      return {
        name: lezer.getNodeText(source, keyword).replace(/^@/, ""),
        prelude: source.slice(keyword.to, block.from).trim(),
      };
    }
  }

  if (node.name === "MediaStatement") {
    const block = node.getChild("Block");
    const keyword = node.firstChild;
    if (!block || !keyword) return null;
    return {
      name: "media",
      prelude: source.slice(keyword.to, block.from).trim(),
    };
  }

  if (node.name !== "AtRule") return null;

  const keyword = node.getChild("AtKeyword");
  if (!keyword) return null;

  const name = lezer.getNodeText(source, keyword).replace(/^@/, "");
  if (name === "property") return null;

  const block = node.getChild("Block");
  return {
    name,
    prelude: source.slice(keyword.to, block ? block.from : node.to).trim(),
  };
}

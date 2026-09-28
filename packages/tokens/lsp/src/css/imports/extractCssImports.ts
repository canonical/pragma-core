import type { Tree } from "../lezer/index.js";
import * as lezer from "../lezer/index.js";

/** Extract CSS @import paths from CSS/SCSS source text. */
export default function extractCssImports(
  source: string,
  tree?: Tree,
): string[] {
  const results: string[] = [];
  const parsed = tree ?? lezer.parseCSS(source);

  visit(parsed.topNode, (node) => {
    if (node.name !== "ImportStatement") return;

    const stringNode = node.getChild("StringLiteral");
    if (stringNode) {
      results.push(stripQuotes(lezer.getNodeText(source, stringNode)));
      return;
    }

    const callNode = node.getChild("CallLiteral");
    if (!callNode) return;
    const callString = callNode.getChild("StringLiteral");
    if (callString) {
      results.push(stripQuotes(lezer.getNodeText(source, callString)));
      return;
    }

    const raw = lezer.getNodeText(source, callNode).trim();
    const inner = raw
      .replace(/^url\(/i, "")
      .replace(/\)$/, "")
      .trim();
    if (inner) results.push(stripQuotes(inner));
  });

  return results;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function visit(
  node: import("../lezer/index.js").SyntaxNode,
  onNode: (node: import("../lezer/index.js").SyntaxNode) => void,
): void {
  onNode(node);
  for (let child = node.firstChild; child; child = child.nextSibling) {
    visit(child, onNode);
  }
}

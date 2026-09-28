import type { SyntaxNode } from "./types.js";

export default function getNodeText(
  source: string,
  node: Pick<SyntaxNode, "from" | "to">,
): string {
  return source.slice(node.from, node.to);
}

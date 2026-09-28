import type { CSSNode } from "./types.js";

export default function hasDeclaration(
  nodes: CSSNode[],
  property: string,
): boolean {
  return nodes.some(
    (node) => node.type === "Declaration" && node.property === property,
  );
}

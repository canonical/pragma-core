import hasDeclaration from "./hasDeclaration.js";
import type { CSSDeclaration, CSSNode } from "./types.js";

export default function addDeclarationUnique(
  nodes: CSSNode[],
  decl: CSSDeclaration,
): void {
  if (!hasDeclaration(nodes, decl.property)) {
    nodes.push(decl);
  }
}

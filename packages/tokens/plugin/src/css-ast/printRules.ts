/** Print an array of CSS AST nodes into a formatted CSS string. */

import printNode from "./printNode.js";
import type { CSSNode, PrintOptions } from "./types.js";

export default function printRules(
  nodes: CSSNode[],
  opts: PrintOptions = {},
): string {
  const { indentChar = "\t", indentLv = 0 } = opts;
  let output = "";
  for (const node of nodes) {
    if (output && node.type === "Rule") {
      output += "\n";
    }
    output += printNode(node, { indentChar, indentLv });
  }
  return output.trimEnd();
}

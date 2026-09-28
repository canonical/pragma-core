/** Print a single CSS AST node. */
import type { CSSNode } from "./types.js";

export default function printNode(
  node: CSSNode,
  { indentChar, indentLv }: { indentChar: string; indentLv: number },
): string {
  const indent = indentChar.repeat(indentLv);

  if (node.type === "Declaration") {
    let out = "";
    if (node.comment) {
      out += `${indent}/* ${node.comment} */\n`;
    }
    out += `${indent}${node.property}: ${node.value};\n`;
    return out;
  }

  // Rule — skip if empty prelude or children
  if (!node.prelude.length || !node.children.length) {
    return "";
  }

  let childOutput = "";
  for (const child of node.children) {
    childOutput += printNode(child, { indentChar, indentLv: indentLv + 1 });
  }
  if (!childOutput.trim()) {
    return "";
  }

  let out = "";
  out += `${indent}${node.prelude.join(`,\n${indent}`)} {\n`;
  out += childOutput;
  out += `${indent}}\n`;
  return out;
}

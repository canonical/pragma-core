export default function extractDeclarationValue(
  source: string,
  declaration: import("../lezer/index.js").SyntaxNode,
): string {
  const colon = declaration.getChild(":");
  const valueFrom = colon ? colon.to : declaration.from;
  return source.slice(valueFrom, declaration.to).trim();
}

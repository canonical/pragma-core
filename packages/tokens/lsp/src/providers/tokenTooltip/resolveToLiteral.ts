import type { TokenGraph } from "../../graph/index.js";

export default function resolveToLiteral(
  value: string | null,
  graph: TokenGraph,
  mode: "light" | "dark",
  visited: Set<string> = new Set(),
): string {
  if (!value) return "?";
  const match = value.match(/^var\((--[\w-]+)\)$/);
  if (!match) return value;
  const reference = match[1];
  if (visited.has(reference)) return value;
  visited.add(reference);
  const target = graph.resolveToken(reference);
  if (!target) return value;
  const nextValue =
    mode === "dark"
      ? (target.valueDark ?? target.valueLight)
      : target.valueLight;
  return resolveToLiteral(nextValue, graph, mode, visited);
}

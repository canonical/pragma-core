import * as scanners from "../css/scanners/index.js";
import type { TokenGraph } from "../graph/index.js";
import type { Position, ResolvedConfig, TokenNode } from "../types/index.js";

/** An inlay hint to display after a `var()` reference. */
export interface InlayHint {
  position: Position;
  label: string;
  /** "type" hints appear after the annotated construct. */
  kind: 1; // InlayHintKind.Type
  paddingLeft: boolean;
}

/**
 * Produce inlay hints for `var()` references in the visible range.
 *
 * Each hint shows the resolved value of the referenced token,
 * positioned after the closing `)` of the `var()` call.
 */
export default function provideInlayHints(
  source: string,
  fileUri: string,
  graph: TokenGraph,
  config: ResolvedConfig,
  range: { start: Position; end: Position },
): InlayHint[] {
  if (!config.inlayHints.enabled) return [];

  const usages = scanners.scanUsages(source, fileUri);
  const hints: InlayHint[] = [];
  const lines = source.split("\n");

  for (const usage of usages) {
    // Only hints in the visible range
    if (usage.line < range.start.line || usage.line > range.end.line) continue;

    const token = graph.resolveToken(usage.cssVar);
    if (!token) continue;

    const resolvedValue = resolveDisplayValue(token, graph);
    if (!resolvedValue) continue;

    // Position the hint after var(--name) or var(--name, fallback)
    const line = lines[usage.line];
    if (!line) continue;
    const varStart = usage.column;
    // Find the matching close paren
    let depth = 0;
    let endCol = varStart;
    for (let i = varStart; i < line.length; i++) {
      if (line[i] === "(") depth++;
      if (line[i] === ")") {
        depth--;
        if (depth === 0) {
          endCol = i + 1;
          break;
        }
      }
    }

    hints.push({
      position: { line: usage.line, character: endCol },
      label: truncateHint(resolvedValue, 30),
      kind: 1, // InlayHintKind.Type
      paddingLeft: true,
    });
  }

  return hints;
}

/**
 * Resolve a token to a display-friendly value string.
 */
function resolveDisplayValue(
  token: TokenNode,
  graph: TokenGraph,
): string | null {
  // Walk alias chain to terminal
  let terminal: TokenNode = token;
  const visited = new Set<string>();
  for (const ref of token.aliasChain) {
    if (visited.has(ref)) break;
    visited.add(ref);
    const target = graph.resolveToken(ref);
    if (target) terminal = target;
    else break;
  }

  if (
    terminal.isPaired &&
    terminal.valueLight &&
    terminal.valueDark &&
    terminal.valueLight !== terminal.valueDark
  ) {
    return `light-dark(${terminal.valueLight}, ${terminal.valueDark})`;
  }
  return terminal.valueLight ?? null;
}

function truncateHint(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}\u2026`;
}

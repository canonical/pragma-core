/** Parse inline terrazzo suppression directives from CSS comments. */
import { KNOWN_CODES } from "../../diagnosticCodes.js";
import type {
  DiagnosticCode,
  SuppressionDirective,
} from "../../types/index.js";
import type { Tree } from "../lezer/index.js";
import * as lezer from "../lezer/index.js";
import * as treeHelpers from "../tree/index.js";

const DIRECTIVE_KINDS = [
  "disable-next-line",
  "disable-line",
  "disable",
  "enable",
] as const;

export default function parseSuppressionDirectives(
  source: string,
  tree?: Tree,
): {
  directives: SuppressionDirective[];
  unknownRules: Array<{ rule: string; line: number }>;
} {
  const directives: SuppressionDirective[] = [];
  const unknownRules: Array<{ rule: string; line: number }> = [];
  const parsed = tree ?? lezer.parseCSS(source);
  const lineOffsets = treeHelpers.buildLineOffsets(source);

  visit(parsed.topNode, (node) => {
    if (node.name !== "Comment") return;

    const text = unwrapComment(lezer.getNodeText(source, node));
    const line = treeHelpers.getLineAt(node.from, lineOffsets);
    let searchFrom = 0;

    while (searchFrom < text.length) {
      const start = text.indexOf("terrazzo-lsp-", searchFrom);
      if (start === -1) break;

      const match = matchDirectiveKind(text, start + "terrazzo-lsp-".length);
      if (!match) {
        searchFrom = start + "terrazzo-lsp-".length;
        continue;
      }

      const next = text.indexOf("terrazzo-lsp-", match.end);
      const ruleListRaw = text
        .slice(match.end, next === -1 ? text.length : next)
        .trim();
      let rules: DiagnosticCode[] | "all";
      if (!ruleListRaw) {
        rules = "all";
      } else {
        const parsedRules = parseRuleList(ruleListRaw, line, unknownRules);
        rules = parsedRules.length > 0 ? parsedRules : "all";
      }
      directives.push({ kind: match.kind, rules, line });
      searchFrom = next === -1 ? text.length : next;
    }
  });

  return { directives, unknownRules };
}

function parseRuleList(
  raw: string,
  line: number,
  unknownRules: Array<{ rule: string; line: number }>,
): DiagnosticCode[] {
  const rules: DiagnosticCode[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (KNOWN_CODES.has(trimmed as DiagnosticCode)) {
      rules.push(trimmed as DiagnosticCode);
      continue;
    }
    unknownRules.push({ rule: trimmed, line });
  }
  return rules;
}

function unwrapComment(text: string): string {
  let comment = text.trim();
  if (comment.startsWith("/*")) comment = comment.slice(2);
  if (comment.endsWith("*/")) comment = comment.slice(0, -2);
  return comment.trim();
}

function matchDirectiveKind(
  text: string,
  start: number,
): { kind: SuppressionDirective["kind"]; end: number } | null {
  for (const kind of DIRECTIVE_KINDS) {
    if (text.startsWith(kind, start)) {
      return {
        kind,
        end: start + kind.length,
      };
    }
  }

  return null;
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

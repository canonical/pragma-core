/** Check whether a diagnostic at a given line is suppressed by directives. */
import type {
  DiagnosticCode,
  SuppressionDirective,
} from "../../types/index.js";

export default function isSuppressed(
  code: DiagnosticCode,
  line: number,
  directives: ReadonlyArray<SuppressionDirective>,
): boolean {
  let allDisabled = false;
  const disabledCodes = new Set<DiagnosticCode>();

  for (const directive of directives) {
    if (directive.kind === "disable-next-line") {
      if (line === directive.line + 1) {
        if (directive.rules === "all") return true;
        if (directive.rules.includes(code)) return true;
      }
      continue;
    }
    if (directive.kind === "disable-line") {
      if (line === directive.line) {
        if (directive.rules === "all") return true;
        if (directive.rules.includes(code)) return true;
      }
      continue;
    }

    if (directive.line > line) break;

    if (directive.kind === "disable") {
      if (directive.rules === "all") allDisabled = true;
      else for (const rule of directive.rules) disabledCodes.add(rule);
    } else if (directive.kind === "enable") {
      if (directive.rules === "all") {
        allDisabled = false;
        disabledCodes.clear();
      } else {
        for (const rule of directive.rules) disabledCodes.delete(rule);
      }
    }
  }

  if (allDisabled) return true;
  return disabledCodes.has(code);
}

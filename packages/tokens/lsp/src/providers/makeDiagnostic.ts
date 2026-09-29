import type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
} from "../types/index.js";

export default function makeDiagnostic(
  line: number,
  column: number,
  severity: DiagnosticSeverity,
  code: DiagnosticCode,
  message: string,
  endColumn: number = column,
): Diagnostic {
  return {
    range: {
      start: { line, character: column },
      end: { line, character: endColumn },
    },
    severity,
    code,
    source: "terrazzo-lsp",
    message,
  };
}

import { describe, expect, it } from "vitest";
import { DiagnosticSeverity } from "../types/index.js";
import makeDiagnostic from "./makeDiagnostic.js";

describe("makeDiagnostic", () => {
  it("builds a Diagnostic with the correct range", () => {
    const d = makeDiagnostic(
      5,
      10,
      DiagnosticSeverity.Warning,
      "css/unknown-var",
      "msg",
    );
    expect(d.range).toEqual({
      start: { line: 5, character: 10 },
      end: { line: 5, character: 10 },
    });
  });

  it("sets source to 'terrazzo-lsp'", () => {
    const d = makeDiagnostic(
      0,
      0,
      DiagnosticSeverity.Error,
      "css/unknown-var",
      "msg",
    );
    expect(d.source).toBe("terrazzo-lsp");
  });

  it("passes through severity, code, and message", () => {
    const d = makeDiagnostic(
      1,
      2,
      DiagnosticSeverity.Error,
      "dtcg/missing-type",
      "test message",
    );
    expect(d.severity).toBe(DiagnosticSeverity.Error);
    expect(d.code).toBe("dtcg/missing-type");
    expect(d.message).toBe("test message");
  });

  it("uses endColumn when provided", () => {
    const d = makeDiagnostic(
      3,
      4,
      DiagnosticSeverity.Warning,
      "css/unknown-var",
      "msg",
      20,
    );
    expect(d.range.end.character).toBe(20);
  });

  it("defaults endColumn to column when not provided", () => {
    const d = makeDiagnostic(
      3,
      4,
      DiagnosticSeverity.Warning,
      "css/unknown-var",
      "msg",
    );
    expect(d.range.start.character).toBe(4);
    expect(d.range.end.character).toBe(4);
  });
});

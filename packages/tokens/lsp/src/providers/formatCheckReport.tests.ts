/**
 * JSON check reporter tests — TDD.
 *
 */
import { describe, expect, it } from "vitest";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type TokenGraphData,
} from "../types/index.js";
import formatCheckReport from "./formatCheckReport.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiag(
  overrides: Partial<Diagnostic> & { code: string },
): Diagnostic {
  return {
    range: {
      start: { line: 5, character: 10 },
      end: { line: 5, character: 20 },
    },
    severity: DiagnosticSeverity.Warning,
    source: "terrazzo-lsp",
    message: "Test diagnostic",
    ...overrides,
  };
}

function makeGraphData(overrides?: Partial<TokenGraphData>): TokenGraphData {
  return {
    tokens: new Map(),
    files: new Map(),
    declarations: new Map(),
    properties: new Map(),
    usages: new Map(),
    declarationsByFile: new Map(),
    propertiesByFile: new Map(),
    usagesByFile: new Map(),
    imports: new Map(),
    importedBy: new Map(),
    allVars: new Set(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("formatCheckReport", () => {
  it("returns valid JSON structure with summary and diagnostics", () => {
    const diagnostics = new Map<string, Diagnostic[]>();
    diagnostics.set("file:///src/a.css", [
      makeDiag({
        code: "css/type-mismatch",
        severity: DiagnosticSeverity.Error,
        message: "Type mismatch",
      }),
    ]);
    diagnostics.set("file:///src/b.css", [
      makeDiag({
        code: "css/missing-fallback",
        severity: DiagnosticSeverity.Warning,
        message: "Missing fallback",
      }),
    ]);

    const report = formatCheckReport(diagnostics, makeGraphData(), 2);

    expect(report.summary.files).toBe(2);
    expect(report.summary.diagnostics.error).toBe(1);
    expect(report.summary.diagnostics.warning).toBe(1);
    expect(report.summary.navigationTier).toBe(2);
    expect(report.diagnostics).toHaveLength(2);
  });

  it("counts graph nodes correctly", () => {
    const graphData = makeGraphData();
    graphData.tokens.set("--a", {} as never);
    graphData.tokens.set("--b", {} as never);
    graphData.files.set("file:///a.css", {} as never);
    graphData.declarations.set("--a", [{} as never]);
    graphData.properties.set("--a", {} as never);
    graphData.imports.set("file:///a.css", new Set(["file:///b.css"]));

    const report = formatCheckReport(new Map(), graphData, 1);

    expect(report.summary.graph.tokenNodes).toBe(2);
    expect(report.summary.graph.fileNodes).toBe(1);
    expect(report.summary.graph.declarationNodes).toBe(1);
    expect(report.summary.graph.propertyNodes).toBe(1);
    expect(report.summary.graph.importEdges).toBe(1);
  });

  it("maps severity to string correctly", () => {
    const diagnostics = new Map<string, Diagnostic[]>();
    diagnostics.set("file:///a.css", [
      makeDiag({
        code: "css/type-mismatch",
        severity: DiagnosticSeverity.Error,
      }),
      makeDiag({
        code: "css/missing-fallback",
        severity: DiagnosticSeverity.Warning,
      }),
      makeDiag({
        code: "dtcg/missing-type",
        severity: DiagnosticSeverity.Information,
      }),
      makeDiag({ code: "css/scoped-usage", severity: DiagnosticSeverity.Hint }),
    ]);

    const report = formatCheckReport(diagnostics, makeGraphData(), 2);

    const severities = report.diagnostics.map((d) => d.severity);
    expect(severities).toContain("error");
    expect(severities).toContain("warning");
    expect(severities).toContain("info");
    expect(severities).toContain("hint");
  });

  it("strips file:// prefix from diagnostic file paths", () => {
    const diagnostics = new Map<string, Diagnostic[]>();
    diagnostics.set("file:///src/components/Button.css", [
      makeDiag({ code: "css/type-mismatch" }),
    ]);

    const report = formatCheckReport(diagnostics, makeGraphData(), 2);

    expect(report.diagnostics[0].file).toBe("/src/components/Button.css");
  });

  it("returns empty diagnostics when no issues", () => {
    const report = formatCheckReport(new Map(), makeGraphData(), 2);
    expect(report.summary.files).toBe(0);
    expect(report.summary.diagnostics.error).toBe(0);
    expect(report.diagnostics).toHaveLength(0);
  });
});

/**
 * Code actions provider tests — TDD (P8.6 gate).
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type RawArtifact,
} from "../types/index.js";
import provideCodeActions from "./provideCodeActions.js";

const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-fg": {
      id: "color.foreground",
      type: "color",
      value: "#000",
      valueLight: "#000",
      valueDark: "#fff",
      isPaired: true,
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
    },
    "--color-raw-blue": {
      id: "color.raw.blue",
      type: "color",
      value: "#0000ff",
      tier: "primitive",
      cssOutputFile: "/project/dist/tokens.css",
    },
    "--color-brand": {
      id: "color.brand",
      type: "color",
      value: "#0000ff",
      valueLight: "#0000ff",
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
      aliasOf: "--color-raw-blue",
    },
  },
};

describe("provideCodeActions", () => {
  it("provides missing-fallback fix (P8.6)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const source = ".box { color: var(--color-fg); }";
    const diag: Diagnostic = {
      range: {
        start: { line: 0, character: 18 },
        end: { line: 0, character: 28 },
      },
      severity: DiagnosticSeverity.Warning,
      code: "css/missing-fallback",
      source: "terrazzo-lsp",
      message: "Missing fallback",
    };
    const actions = provideCodeActions("file:///a.css", source, [diag], graph);
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions.find((a) => a.title.includes("Add fallback"));
    expect(fix).toBeDefined();
    expect(fix?.kind).toBe("quickfix");
    expect(fix?.edit).toBeDefined();
  });

  it("provides stale-fallback fix (P8.6)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const source = ".box { color: var(--color-fg, oldvalue); }";
    const diag: Diagnostic = {
      range: {
        start: { line: 0, character: 18 },
        end: { line: 0, character: 28 },
      },
      severity: DiagnosticSeverity.Warning,
      code: "css/stale-fallback",
      source: "terrazzo-lsp",
      message: "Stale fallback",
    };
    const actions = provideCodeActions("file:///a.css", source, [diag], graph);
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const fix = actions.find((a) => a.title.includes("Update fallback"));
    expect(fix).toBeDefined();
    expect(fix?.kind).toBe("quickfix");
  });

  it("stale-fallback fix handles nested-paren fallbacks without unbalancing", () => {
    // Regression: a `[^)]+` fallback match truncated at the inner ')', leaving
    // a stray trailing ')' in the output. The fix must span the whole var().
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const source = ".box { color: var(--color-fg, calc(1rem + 2px)); }";
    const diag: Diagnostic = {
      range: {
        start: { line: 0, character: 18 },
        end: { line: 0, character: 28 },
      },
      severity: DiagnosticSeverity.Warning,
      code: "css/stale-fallback",
      source: "terrazzo-lsp",
      message: "Stale fallback",
    };
    const actions = provideCodeActions("file:///a.css", source, [diag], graph);
    const edit = actions.find((a) => a.title.includes("Update fallback"))?.edit
      ?.changes["file:///a.css"]?.[0];
    expect(edit?.newText).toBe("var(--color-fg, #000)");
    const applied =
      source.slice(0, edit?.range.start.character) +
      edit?.newText +
      source.slice(edit?.range.end.character);
    expect(applied).toBe(".box { color: var(--color-fg, #000); }");
  });

  it("provides primitive-token fix when semantic alias exists (P8.6)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const source = ".box { color: var(--color-raw-blue); }";
    const diag: Diagnostic = {
      range: {
        start: { line: 0, character: 18 },
        end: { line: 0, character: 34 },
      },
      severity: DiagnosticSeverity.Warning,
      code: "css/primitive-token",
      source: "terrazzo-lsp",
      message: "Primitive token",
    };
    const actions = provideCodeActions("file:///a.css", source, [diag], graph);
    const fix = actions.find((a) => a.title.includes("semantic token"));
    expect(fix).toBeDefined();
    expect(fix?.edit?.changes["file:///a.css"][0].newText).toBe(
      "--color-brand",
    );
  });

  it("returns at least 3 code actions for appropriate diagnostics (\u2265 3 actions gate)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const source =
      ".box { color: var(--color-fg); background: var(--color-fg, old); border-color: var(--color-raw-blue); }";
    const diagnostics: Diagnostic[] = [
      {
        range: {
          start: { line: 0, character: 18 },
          end: { line: 0, character: 28 },
        },
        severity: DiagnosticSeverity.Warning,
        code: "css/missing-fallback",
        source: "terrazzo-lsp",
        message: "Missing fallback",
      },
      {
        range: {
          start: { line: 0, character: 45 },
          end: { line: 0, character: 55 },
        },
        severity: DiagnosticSeverity.Warning,
        code: "css/stale-fallback",
        source: "terrazzo-lsp",
        message: "Stale fallback",
      },
      {
        range: {
          start: { line: 0, character: 81 },
          end: { line: 0, character: 97 },
        },
        severity: DiagnosticSeverity.Warning,
        code: "css/primitive-token",
        source: "terrazzo-lsp",
        message: "Primitive token",
      },
    ];
    const actions = provideCodeActions(
      "file:///a.css",
      source,
      diagnostics,
      graph,
    );
    expect(actions.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty for unknown diagnostic codes", () => {
    const graph = new TokenGraph();
    const diag: Diagnostic = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
      },
      severity: DiagnosticSeverity.Warning,
      code: "css/unknown-rule",
      source: "terrazzo-lsp",
      message: "Unknown",
    };
    const actions = provideCodeActions(
      "file:///a.css",
      ".box {}",
      [diag],
      graph,
    );
    expect(actions).toEqual([]);
  });
});

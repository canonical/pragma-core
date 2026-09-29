import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import { type Diagnostic, DiagnosticSeverity } from "../../types/index.js";
import checkUnknownVar from "./checkUnknownVar.js";
import type { UsageRuleContext } from "./types.js";

function makeContext(overrides?: Partial<UsageRuleContext>): UsageRuleContext {
  return {
    usage: {
      cssVar: "--unknown",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      varNameColumn: 16,
      varNameLength: 9,
      property: "color",
      fallback: null,
    },
    token: null,
    prop: null,
    isRegistered: false,
    lineText: ".x { color: var(--unknown); }",
    insideMath: false,
    fileUri: "file:///a.css",
    reachableFiles: new Set(),
    globalUris: new Set(),
    config: makeConfig({
      diagnostics: new Map([
        ...makeConfig().diagnostics,
        ["css/unknown-var", DiagnosticSeverity.Warning],
      ]),
    }),
    directives: [],
    graph: new TokenGraph(),
    ...overrides,
  };
}

describe("checkUnknownVar", () => {
  it("emits diagnostic when var references unknown custom property", () => {
    const results: Diagnostic[] = [];
    checkUnknownVar(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/unknown-var");
  });

  it("does NOT emit when token exists in graph", () => {
    const graph = new TokenGraph();
    graph.addToken(makeTokenNode({ cssVar: "--unknown" }));
    const results: Diagnostic[] = [];
    checkUnknownVar(makeContext({ graph }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when @property exists in graph", () => {
    const graph = new TokenGraph();
    graph.addProperty({
      cssVar: "--unknown",
      fileUri: "file:///a.css",
      line: 0,
      syntax: "<color>",
      inherits: true,
      initialValue: null,
      cssType: "<color>",
    });
    const results: Diagnostic[] = [];
    checkUnknownVar(makeContext({ graph }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when declaration exists in graph", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--unknown",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      rawValue: "red",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });
    const results: Diagnostic[] = [];
    checkUnknownVar(makeContext({ graph }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off (default for css/unknown-var)", () => {
    const results: Diagnostic[] = [];
    checkUnknownVar(makeContext({ config: makeConfig() }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when suppressed", () => {
    const results: Diagnostic[] = [];
    checkUnknownVar(
      makeContext({
        directives: [
          { kind: "disable-line", rules: ["css/unknown-var"], line: 0 },
        ],
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

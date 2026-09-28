import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeDeclarationNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkScopedUsage from "./checkScopedUsage.js";
import type { UsageRuleContext } from "./types.js";

function makeContext(overrides?: Partial<UsageRuleContext>): UsageRuleContext {
  return {
    usage: {
      cssVar: "--btn-color",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      varNameColumn: 16,
      varNameLength: 11,
      property: "color",
      fallback: null,
    },
    token: null,
    prop: null,
    isRegistered: false,
    lineText: ".x { color: var(--btn-color); }",
    insideMath: false,
    fileUri: "file:///a.css",
    reachableFiles: new Set(),
    globalUris: new Set(),
    config: makeConfig(),
    directives: [],
    graph: new TokenGraph(),
    ...overrides,
  };
}

describe("checkScopedUsage", () => {
  it("emits diagnostic when var is declared under a scoped selector in a different file", () => {
    const graph = new TokenGraph();
    graph.addDeclaration(
      makeDeclarationNode({
        cssVar: "--btn-color",
        fileUri: "file:///button.css",
        selector: {
          selector: ".button",
          atRules: [],
          scopeType: "class",
          isGlobal: false,
          isScoped: true,
        },
      }),
    );
    const results: Diagnostic[] = [];
    checkScopedUsage(makeContext({ graph }), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/scoped-usage");
  });

  it("does NOT emit when no declarations exist", () => {
    const results: Diagnostic[] = [];
    checkScopedUsage(makeContext(), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when scoped declaration is in the same file", () => {
    const graph = new TokenGraph();
    graph.addDeclaration(
      makeDeclarationNode({
        cssVar: "--btn-color",
        fileUri: "file:///a.css",
        selector: {
          selector: ".button",
          atRules: [],
          scopeType: "class",
          isGlobal: false,
          isScoped: true,
        },
      }),
    );
    const results: Diagnostic[] = [];
    checkScopedUsage(makeContext({ graph }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when a global declaration also exists", () => {
    const graph = new TokenGraph();
    graph.addDeclaration(
      makeDeclarationNode({
        cssVar: "--btn-color",
        fileUri: "file:///button.css",
        selector: {
          selector: ".button",
          atRules: [],
          scopeType: "class",
          isGlobal: false,
          isScoped: true,
        },
      }),
    );
    graph.addDeclaration(
      makeDeclarationNode({
        cssVar: "--btn-color",
        fileUri: "file:///global.css",
      }),
    );
    const results: Diagnostic[] = [];
    checkScopedUsage(makeContext({ graph }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const graph = new TokenGraph();
    graph.addDeclaration(
      makeDeclarationNode({
        cssVar: "--btn-color",
        fileUri: "file:///button.css",
        selector: {
          selector: ".button",
          atRules: [],
          scopeType: "class",
          isGlobal: false,
          isScoped: true,
        },
      }),
    );
    const results: Diagnostic[] = [];
    checkScopedUsage(
      makeContext({
        graph,
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/scoped-usage", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

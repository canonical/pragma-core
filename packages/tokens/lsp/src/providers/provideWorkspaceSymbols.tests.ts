/**
 * Workspace symbol provider tests — TDD.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import type { RawArtifact } from "../types/index.js";
import provideWorkspaceSymbols from "./provideWorkspaceSymbols.js";
import { SymbolKind } from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-fg": {
      id: "color.foreground",
      type: "color",
      value: "#000",
      description: "Primary foreground colour",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
      sourceFile: "/src/tokens/color.tokens.json",
      sourceLine: 5,
    },
    "--color-bg": {
      id: "color.background",
      type: "color",
      value: "#fff",
      description: "Primary background colour",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
      sourceFile: "/src/tokens/color.tokens.json",
      sourceLine: 10,
    },
    "--spacing-sm": {
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      tier: "primitive",
      cssOutputFile: "/dist/tokens.css",
      sourceFile: "/src/tokens/spacing.tokens.json",
      sourceLine: 3,
    },
  },
};

function makeGraph(): TokenGraph {
  const graph = new TokenGraph();
  loadArtifact(ARTIFACT, graph);
  return graph;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("provideWorkspaceSymbols", () => {
  it("does not expose internal artifact channels", () => {
    const graph = new TokenGraph();
    loadArtifact(
      {
        "--internal-channel": {
          id: null,
          type: "dimension",
          tier: "derived",
          visibility: "internal",
          cssOutputFile: "/dist/tokens.css",
        },
      } as RawArtifact,
      graph,
    );
    graph.addProperty({
      cssVar: "--internal-channel",
      fileUri: "file:///tokens.css",
      line: 1,
      syntax: "<length>",
      inherits: true,
      initialValue: "0px",
      cssType: "<length>",
    });
    expect(provideWorkspaceSymbols("internal", graph)).toEqual([]);
  });

  it("returns empty array for empty query", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("", graph);
    expect(results).toEqual([]);
  });

  it("matches by CSS variable name", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("color-fg", graph);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("--color-fg");
  });

  it("matches by token ID", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("color.foreground", graph);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("--color-fg");
  });

  it("matches by description text", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("background colour", graph);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("--color-bg");
  });

  it("supports fuzzy matching", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("fg", graph);
    expect(results.some((s) => s.name === "--color-fg")).toBe(true);
  });

  it("returns correct symbol kind for tokens", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("color-fg", graph);
    expect(results[0].kind).toBe(SymbolKind.Variable);
  });

  it("includes container name from package source", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph, "@acme/tokens");
    const results = provideWorkspaceSymbols("color-fg", graph);
    expect(results[0].containerName).toBe("@acme/tokens");
  });

  it("filters by type: prefix", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("type:dimension", graph);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("--spacing-sm");
  });

  it("filters by layer: prefix (tier)", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("layer:primitive", graph);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("--spacing-sm");
  });

  it("returns multiple results for broad queries", () => {
    const graph = makeGraph();
    const results = provideWorkspaceSymbols("color", graph);
    expect(results.length).toBe(2);
  });

  it("includes @property registrations", () => {
    const graph = new TokenGraph();
    graph.addProperty({
      cssVar: "--custom-prop",
      fileUri: "file:///a.css",
      line: 5,
      syntax: "<color>",
      inherits: true,
      initialValue: "red",
      cssType: "<color>",
    });

    const results = provideWorkspaceSymbols("custom-prop", graph);
    expect(results.length).toBe(1);
    expect(results[0].kind).toBe(SymbolKind.Property);
  });

  it("includes CSS declarations", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--local-var",
      fileUri: "file:///comp.css",
      line: 3,
      column: 4,
      rawValue: "blue",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const results = provideWorkspaceSymbols("local-var", graph);
    expect(results.length).toBe(1);
    expect(results[0].kind).toBe(SymbolKind.Constant);
  });

  // ── P8.3 gate: type: and scope: filters ─────────────────────
  it("filters by type: prefix (P8.3)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const colors = provideWorkspaceSymbols("type:color", graph);
    expect(colors.length).toBeGreaterThan(0);
    // All results should be color tokens
    for (const sym of colors) {
      // --color-fg and --color-raw-blue are color tokens
      expect(sym.name).toMatch(/color/);
    }

    const dimensions = provideWorkspaceSymbols("type:dimension", graph);
    expect(dimensions.length).toBeGreaterThan(0);
  });

  it("filters by scope: prefix (P8.3)", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--scoped-var",
      fileUri: "file:///comp.css",
      line: 5,
      column: 4,
      rawValue: "red",
      cssType: "<color>",
      selector: {
        selector: ".button",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    });
    graph.addDeclaration({
      cssVar: "--global-var",
      fileUri: "file:///tokens.css",
      line: 1,
      column: 2,
      rawValue: "blue",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const scoped = provideWorkspaceSymbols("scope:button", graph);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].name).toBe("--scoped-var");
  });

  it("filters by file: prefix", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    // The artifact tokens have sourceFile containing "tokens.json"
    const results = provideWorkspaceSymbols("file:tokens.json", graph);
    expect(results.length).toBeGreaterThan(0);

    const noResults = provideWorkspaceSymbols("file:nonexistent.xyz", graph);
    expect(noResults).toHaveLength(0);
  });
});

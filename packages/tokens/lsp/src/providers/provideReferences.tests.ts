/**
 * textDocument/references provider tests — TDD (P8.1 gate).
 */
import { describe, expect, it } from "vitest";
import { TokenGraph } from "../graph/index.js";
import provideReferences from "./provideReferences.js";

describe("provideReferences", () => {
  it("returns empty for an unknown variable", () => {
    const graph = new TokenGraph();
    expect(provideReferences("--nope", graph)).toEqual([]);
  });

  it("returns usage sites", () => {
    const graph = new TokenGraph();
    graph.addUsage({
      cssVar: "--color-bg",
      fileUri: "file:///app.css",
      line: 5,
      column: 10,
      varNameColumn: 14,
      varNameLength: 10,
      property: "background",
      fallback: null,
    });
    const locs = provideReferences("--color-bg", graph);
    expect(locs).toHaveLength(1);
    expect(locs[0].uri).toBe("file:///app.css");
    expect(locs[0].range.start.line).toBe(5);
  });

  it("returns declaration sites", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--color-bg",
      fileUri: "file:///tokens.css",
      line: 2,
      column: 4,
      rawValue: "#fff",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });
    const locs = provideReferences("--color-bg", graph);
    expect(locs).toHaveLength(1);
    expect(locs[0].uri).toBe("file:///tokens.css");
    expect(locs[0].range.start.line).toBe(2);
    expect(locs[0].range.start.character).toBe(4);
    expect(locs[0].range.end.character).toBe(4 + "--color-bg".length);
  });

  it("returns both usages and declarations (P8.1)", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--spacing-sm",
      fileUri: "file:///tokens.css",
      line: 1,
      column: 2,
      rawValue: "8px",
      cssType: "<length>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });
    graph.addUsage({
      cssVar: "--spacing-sm",
      fileUri: "file:///app.css",
      line: 10,
      column: 12,
      varNameColumn: 16,
      varNameLength: 12,
      property: "padding",
      fallback: null,
    });
    const locs = provideReferences("--spacing-sm", graph);
    expect(locs).toHaveLength(2);
    const uris = locs.map((l) => l.uri);
    expect(uris).toContain("file:///app.css");
    expect(uris).toContain("file:///tokens.css");
  });
});

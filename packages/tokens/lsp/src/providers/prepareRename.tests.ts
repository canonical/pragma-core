/**
 * prepareRename provider tests — TDD (P8.2 gate).
 */
import { describe, expect, it } from "vitest";
import { TokenGraph } from "../graph/index.js";
import prepareRename from "./prepareRename.js";

describe("prepareRename", () => {
  it("returns null for cursor not on a custom property", () => {
    const graph = new TokenGraph();
    const source = ".box { color: red; }";
    expect(prepareRename(source, { line: 0, character: 5 }, graph)).toBeNull();
  });

  it("returns null for unknown custom property", () => {
    const graph = new TokenGraph();
    const source = ".box { color: var(--unknown); }";
    expect(prepareRename(source, { line: 0, character: 20 }, graph)).toBeNull();
  });

  it("returns range and placeholder for a known token", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--color-bg",
      fileUri: "file:///a.css",
      line: 0,
      column: 2,
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
    const source = ":root { --color-bg: #fff; }";
    const result = prepareRename(source, { line: 0, character: 12 }, graph);
    expect(result).not.toBeNull();
    expect(result?.placeholder).toBe("--color-bg");
    expect(result?.range.start.character).toBe(8);
    expect(result?.range.end.character).toBe(8 + "--color-bg".length);
  });

  it("validates rename target is known in graph (P8.2)", () => {
    const graph = new TokenGraph();
    // Add a var so it's known
    graph.addDeclaration({
      cssVar: "--spacing-sm",
      fileUri: "file:///a.css",
      line: 0,
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
    const source = ".box { padding: var(--spacing-sm); }";
    // Cursor on --spacing-sm inside var()
    const result = prepareRename(source, { line: 0, character: 23 }, graph);
    expect(result).not.toBeNull();
    expect(result?.placeholder).toBe("--spacing-sm");
  });
});

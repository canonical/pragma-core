/**
 * Go-to-definition provider tests — TDD.
 *
 * Tests navigation to source file, @property block, and declaration sites.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import type { RawArtifact } from "../types/index.js";
import resolveDefinition from "./resolveDefinition.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-bg": {
      id: "color.background",
      type: "color",
      value: "#fff",
      sourceFile: "/project/tokens/semantic/color.tokens.json",
      sourceLine: 12,
      cssOutputFile: "/project/dist/tokens.css",
      cssOutputLine: 89,
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveDefinition", () => {
  it("returns empty array for unknown variable", () => {
    const graph = new TokenGraph();
    const result = resolveDefinition("--nope", graph);
    expect(result).toEqual([]);
  });

  it("navigates to artifact sourceFile (Tier 2)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = resolveDefinition("--color-bg", graph);
    expect(result.length).toBeGreaterThan(0);

    // Should target the source token file
    const link = result[0];
    expect(link.targetUri).toContain("color.tokens.json");
    expect(link.targetRange.start.line).toBe(12);
  });

  it("navigates to @property block", () => {
    const graph = new TokenGraph();
    graph.addProperty({
      cssVar: "--accent",
      fileUri: "file:///theme.css",
      line: 5,
      syntax: "<color>",
      inherits: true,
      initialValue: "blue",
      cssType: "<color>",
    });

    const result = resolveDefinition("--accent", graph);
    expect(result).toHaveLength(1);
    expect(result[0].targetUri).toBe("file:///theme.css");
    expect(result[0].targetRange.start.line).toBe(5);
  });

  it("navigates to declaration sites", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--local-x",
      fileUri: "file:///button.css",
      line: 10,
      column: 2,
      rawValue: "12px",
      cssType: "<length>",
      selector: {
        selector: ".button",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    });

    const result = resolveDefinition("--local-x", graph);
    expect(result).toHaveLength(1);
    expect(result[0].targetUri).toBe("file:///button.css");
    expect(result[0].targetRange.start.line).toBe(10);
  });

  it("returns all declaration sites when multiple exist", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--x",
      fileUri: "file:///a.css",
      line: 1,
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
    graph.addDeclaration({
      cssVar: "--x",
      fileUri: "file:///b.css",
      line: 5,
      column: 0,
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

    const result = resolveDefinition("--x", graph);
    expect(result).toHaveLength(2);
  });

  it("prefers artifact source over declarations", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    // Also add a declaration for the same var
    graph.addDeclaration({
      cssVar: "--color-bg",
      fileUri: "file:///dist/tokens.css",
      line: 89,
      column: 0,
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

    const result = resolveDefinition("--color-bg", graph);
    // First result should be the artifact source (Tier 2)
    expect(result[0].targetUri).toContain("color.tokens.json");
  });
});

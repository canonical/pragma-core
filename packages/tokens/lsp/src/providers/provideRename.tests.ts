/**
 * Rename-with-cascade provider tests — TDD.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import type { RawArtifact } from "../types/index.js";
import provideRename from "./provideRename.js";

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
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
      sourceFile: "/src/tokens/color.tokens.json",
      sourceLine: 5,
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("provideRename", () => {
  it("returns null for unknown cssVar", () => {
    const graph = new TokenGraph();
    const result = provideRename("--nonexistent", "--new-name", graph);
    expect(result).toBeNull();
  });

  it("renames artifact token across all usage sites", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    graph.addUsage({
      cssVar: "--color-fg",
      fileUri: "file:///a.css",
      line: 2,
      column: 16,
      property: "color",
      fallback: null,
    });
    graph.addUsage({
      cssVar: "--color-fg",
      fileUri: "file:///b.css",
      line: 5,
      column: 22,
      property: "background-color",
      fallback: null,
    });

    const result = provideRename("--color-fg", "--color-foreground", graph);
    expect(result).not.toBeNull();
    expect(result?.requiresRebuild).toBe(true);

    // Should have edits for both files
    const uris = Object.keys(result?.edit.changes);
    expect(uris).toContain("file:///a.css");
    expect(uris).toContain("file:///b.css");
  });

  it("edits only the --name span at usage sites, not the var( call", () => {
    // Regression: usage edits must use varNameColumn/varNameLength, not the
    // var( column. Otherwise rename corrupts every usage, e.g. turning
    // `var(--color-fg)` into `--fgr-fg)`.
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    // "  color: var(--color-fg);" → var( at col 9, --color-fg at col 13, len 10
    graph.addUsage({
      cssVar: "--color-fg",
      fileUri: "file:///a.css",
      line: 0,
      column: 9,
      varNameColumn: 13,
      varNameLength: 10,
      property: "color",
      fallback: null,
    });

    const result = provideRename("--color-fg", "--fg", graph);
    const edits = result?.edit.changes["file:///a.css"];
    expect(edits).toHaveLength(1);
    expect(edits?.[0].range).toEqual({
      start: { line: 0, character: 13 },
      end: { line: 0, character: 23 },
    });
    expect(edits?.[0].newText).toBe("--fg");
  });

  it("renames declaration sites", () => {
    const graph = new TokenGraph();

    graph.addDeclaration({
      cssVar: "--my-var",
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
    graph.addUsage({
      cssVar: "--my-var",
      fileUri: "file:///comp.css",
      line: 8,
      column: 14,
      property: "color",
      fallback: null,
    });

    const result = provideRename("--my-var", "--renamed-var", graph);
    expect(result).not.toBeNull();
    expect(result?.requiresRebuild).toBe(false);

    const edits = result?.edit.changes["file:///comp.css"];
    expect(edits).toBeDefined();
    // Should include both declaration and usage edits
    expect(edits.length).toBe(2);
  });

  it("renames @property registrations", () => {
    const graph = new TokenGraph();

    graph.addProperty({
      cssVar: "--my-prop",
      fileUri: "file:///tokens.css",
      line: 0,
      syntax: "<color>",
      inherits: true,
      initialValue: "red",
      cssType: "<color>",
    });
    graph.addUsage({
      cssVar: "--my-prop",
      fileUri: "file:///a.css",
      line: 5,
      column: 16,
      property: "color",
      fallback: null,
    });

    const result = provideRename("--my-prop", "--renamed-prop", graph);
    expect(result).not.toBeNull();
    expect(result?.requiresRebuild).toBe(false);

    // Property file should have edits
    expect(result?.edit.changes["file:///tokens.css"]).toBeDefined();
    expect(result?.edit.changes["file:///a.css"]).toBeDefined();
  });

  it("does not require rebuild for declaration-only tokens", () => {
    const graph = new TokenGraph();

    graph.addDeclaration({
      cssVar: "--local",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      rawValue: "10px",
      cssType: "<length>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = provideRename("--local", "--renamed-local", graph);
    expect(result).not.toBeNull();
    expect(result?.requiresRebuild).toBe(false);
  });
});

/**
 * Semantic tokens provider tests — TDD.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import type { RawArtifact } from "../types/index.js";
import provideSemanticTokens from "./provideSemanticTokens.js";
import { SEMANTIC_TOKEN_MODIFIERS } from "./types.js";

const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-fg": {
      id: "color.foreground",
      type: "color",
      value: "#000",
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
      registered: false,
    },
    "--color-registered": {
      id: "color.registered",
      type: "color",
      value: "red",
      registered: true,
      syntax: "<color>",
      inherits: true,
      initialValue: "red",
      cssOutputFile: "/project/dist/tokens.css",
    },
  },
};

// Modifier bitmask helper
function modifierBit(name: string): number {
  const idx = SEMANTIC_TOKEN_MODIFIERS.indexOf(
    name as (typeof SEMANTIC_TOKEN_MODIFIERS)[number],
  );
  return idx >= 0 ? 1 << idx : 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("provideSemanticTokens", () => {
  it("returns empty data for CSS with no var() usages", () => {
    const graph = new TokenGraph();
    const source = `.box { color: red; }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);
    expect(data).toEqual([]);
  });

  it("returns semantic token for artifact var() usage", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.box { color: var(--color-fg); }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);

    // Each semantic token is 5 integers: deltaLine, deltaStartChar, length, tokenType, tokenModifiers
    expect(data.length).toBe(5);
    // tokenType should be 0 (designToken)
    expect(data[3]).toBe(0);
    // Should have 'artifact' modifier
    expect(data[4] & modifierBit("artifact")).toBeTruthy();
  });

  it("applies 'registered' modifier for registered tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.box { color: var(--color-registered); }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);

    expect(data.length).toBe(5);
    expect(data[4] & modifierBit("registered")).toBeTruthy();
    expect(data[4] & modifierBit("artifact")).toBeTruthy();
  });

  it("applies 'scoped' modifier for scoped declarations", () => {
    const graph = new TokenGraph();

    graph.addDeclaration({
      cssVar: "--button-pad",
      fileUri: "file:///Button.css",
      line: 2,
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

    const source = `.card { padding: var(--button-pad); }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);

    expect(data.length).toBe(5);
    expect(data[4] & modifierBit("scoped")).toBeTruthy();
  });

  it("applies 'local' modifier for local declarations", () => {
    const graph = new TokenGraph();

    graph.addDeclaration({
      cssVar: "--local-var",
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

    const source = `.box { color: var(--local-var); }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);

    expect(data.length).toBe(5);
    expect(data[4] & modifierBit("local")).toBeTruthy();
  });

  it("returns delta-encoded tokens for multiple usages", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.a { color: var(--color-fg); }\n.b { color: var(--color-fg); }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);

    // Two tokens, 5 integers each
    expect(data.length).toBe(10);
    // Second token should have deltaLine = 1
    expect(data[5]).toBe(1);
  });

  it("handles multiple vars on same line with correct deltaStartChar", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.a { color: var(--color-fg); background: var(--color-fg); }`;
    const data = provideSemanticTokens("file:///a.css", source, graph);

    // Two tokens, 5 integers each
    expect(data.length).toBe(10);
    // Both on line 0, so second deltaLine = 0
    expect(data[5]).toBe(0);
    // deltaStartChar should be positive (second var is after first)
    expect(data[6]).toBeGreaterThan(0);
  });
});

/**
 * Inlay hints provider tests — TDD (P8.4 gate).
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import { makeConfig } from "../testing/index.js";
import type { RawArtifact } from "../types/index.js";
import provideInlayHints from "./provideInlayHints.js";

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
    "--spacing-sm": {
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
    },
  },
};

describe("provideInlayHints", () => {
  it("returns empty when inlay hints are disabled", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const config = makeConfig({
      inlayHints: { enabled: false, showColourSwatches: true },
    });
    const source = ".box { color: var(--color-fg); }";
    const hints = provideInlayHints(source, "file:///a.css", graph, config, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 100 },
    });
    expect(hints).toEqual([]);
  });

  it("shows resolved value for var() references (P8.4)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const config = makeConfig({
      inlayHints: { enabled: true, showColourSwatches: true },
    });
    const source = ".box { color: var(--color-fg); }";
    const hints = provideInlayHints(source, "file:///a.css", graph, config, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 100 },
    });
    expect(hints).toHaveLength(1);
    expect(hints[0].label).toContain("#000");
    expect(hints[0].kind).toBe(1);
    expect(hints[0].paddingLeft).toBe(true);
  });

  it("shows paired light-dark values", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const config = makeConfig({
      inlayHints: { enabled: true, showColourSwatches: true },
    });
    const source = ".box { color: var(--color-fg); }";
    const hints = provideInlayHints(source, "file:///a.css", graph, config, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 100 },
    });
    expect(hints[0].label).toContain("light-dark");
  });

  it("only returns hints for lines in the visible range", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const config = makeConfig({
      inlayHints: { enabled: true, showColourSwatches: true },
    });
    const source = [
      ".box { color: var(--color-fg); }",
      ".card { padding: var(--spacing-sm); }",
    ].join("\n");
    // Only visible range includes line 1
    const hints = provideInlayHints(source, "file:///a.css", graph, config, {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 100 },
    });
    expect(hints).toHaveLength(1);
    expect(hints[0].label).toBe("8px");
  });
});

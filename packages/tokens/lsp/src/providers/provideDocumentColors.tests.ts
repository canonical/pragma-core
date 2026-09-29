/**
 * Document colour provider tests.
 *
 * Tests inline colour swatch generation for `var(--x)` usages
 * where `--x` resolves to a known colour token.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import type { RawArtifact } from "../types/index.js";
import {
  hexToColor,
  provideColorPresentations,
  provideDocumentColors,
} from "./provideDocumentColors.js";

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
      value: "#ffffff",
      valueLight: "#ffffff",
      valueDark: "#1e1e1e",
      isPaired: true,
      tier: "semantic",
    },
    "--color-primary": {
      id: "color.primary",
      type: "color",
      value: "#0066cc",
      valueLight: "#0066cc",
      tier: "semantic",
    },
    "--spacing-sm": {
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      tier: "primitive",
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("provideDocumentColors", () => {
  it("returns colour information for colour token usages", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.card { background: var(--color-bg); }`;
    const results = provideDocumentColors(source, graph);

    expect(results).toHaveLength(1);
    expect(results[0].color).toEqual({
      red: 1,
      green: 1,
      blue: 1,
      alpha: 1,
    });
  });

  it("positions range on the CSS var name", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.card { background: var(--color-bg); }`;
    const results = provideDocumentColors(source, graph);

    expect(results[0].range.start.line).toBe(0);
    expect(results[0].range.start.character).toBe(24);
    expect(results[0].range.end.character).toBe(24 + "--color-bg".length);
  });

  it("handles multiple colour usages on different lines", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = [
      ".card {",
      "  background: var(--color-bg);",
      "  color: var(--color-primary);",
      "}",
    ].join("\n");
    const results = provideDocumentColors(source, graph);

    expect(results).toHaveLength(2);
    expect(results[0].range.start.line).toBe(1);
    expect(results[1].range.start.line).toBe(2);
  });

  it("ignores non-colour tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.card { padding: var(--spacing-sm); }`;
    const results = provideDocumentColors(source, graph);

    expect(results).toHaveLength(0);
  });

  it("ignores unknown variables", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.card { background: var(--unknown-color); }`;
    const results = provideDocumentColors(source, graph);

    expect(results).toHaveLength(0);
  });

  it("handles multiple usages on the same line", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const source = `.card { background: var(--color-bg); color: var(--color-primary); }`;
    const results = provideDocumentColors(source, graph);

    expect(results).toHaveLength(2);
  });
});

describe("hexToColor", () => {
  it("parses 6-digit hex", () => {
    const c = hexToColor("#0066cc");
    expect(c).not.toBeNull();
    expect(c?.red).toBeCloseTo(0, 1);
    expect(c?.green).toBeCloseTo(0.4, 1);
    expect(c?.blue).toBeCloseTo(0.8, 1);
    expect(c?.alpha).toBe(1);
  });

  it("parses 3-digit hex", () => {
    const c = hexToColor("#fff");
    expect(c).toEqual({ red: 1, green: 1, blue: 1, alpha: 1 });
  });

  it("parses 8-digit hex with alpha", () => {
    const c = hexToColor("#ff000080");
    expect(c).not.toBeNull();
    expect(c?.red).toBeCloseTo(1, 1);
    expect(c?.green).toBeCloseTo(0, 1);
    expect(c?.blue).toBeCloseTo(0, 1);
    expect(c?.alpha).toBeCloseTo(0.502, 2);
  });

  it("returns null for invalid hex", () => {
    expect(hexToColor("#xyz")).toBeNull();
    expect(hexToColor("not-hex")).toBeNull();
  });
});

describe("provideColorPresentations", () => {
  it("returns var() wrapper as presentation label", () => {
    const result = provideColorPresentations(
      { red: 1, green: 1, blue: 1, alpha: 1 },
      "--color-bg",
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("var(--color-bg)");
  });
});

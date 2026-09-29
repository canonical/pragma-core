/**
 * Hover provider tests — TDD.
 *
 * Tests hover card generation with provenance badges, colour swatches,
 * selector scope context, and resolution tables.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../graph/index.js";
import { makeConfig } from "../testing/index.js";
import type { RawArtifact } from "../types/index.js";
import provideHover from "./provideHover.js";

/**
 * Artifact with a var() alias chain:
 *   --color-bg -> --color-brand-primary -> --color-palette-orange (literal)
 */
const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-bg": {
      id: "color.background",
      type: "color",
      value: "#ffffff",
      valueLight: "var(--color-brand-primary)",
      valueDark: "var(--color-brand-primary)",
      isPaired: false,
      description: "Page background colour",
      tier: "semantic",
      sourceFile: "/project/tokens/semantic/color.tokens.json",
      sourceLine: 12,
    },
    "--color-brand-primary": {
      id: "color.brand.primary",
      type: "color",
      valueLight: "var(--color-palette-orange)",
      valueDark: "var(--color-palette-orange)",
      isPaired: false,
      tier: "semantic",
    },
    "--color-palette-orange": {
      id: "color.palette.orange",
      type: "color",
      valueLight: "#e95420",
      valueDark: "#e95420",
      isPaired: false,
      tier: "primitive",
    },
    "--color-surface": {
      id: "color.surface",
      type: "color",
      valueLight: "#ffffff",
      valueDark: "#1e1e1e",
      isPaired: true,
      description: "Surface colour with light/dark pairing",
      tier: "semantic",
    },
    "--spacing-sm": {
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      description: "Small spacing unit",
      tier: "primitive",
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("provideHover", () => {
  it("returns null for completely unknown variables", () => {
    const graph = new TokenGraph();
    const result = provideHover("--nope", "file:///a.css", graph, makeConfig());
    expect(result).toBeNull();
  });

  it("returns markdown hover for artifact tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("markdown");
    // Token name doesn't appear (it's what you hovered on) — but value does
    expect(result?.value).toContain("Semantic");
  });

  it("includes provenance badge for artifact tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // ● **Semantic `color`**
    expect(result?.value).toContain("\u25CF");
    expect(result?.value).toContain("Semantic");
  });

  it("includes description", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("Page background colour");
  });

  it("shows resolution table with alias chain", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Resolution table (self-row omitted — code block covers that)
    expect(result?.value).toContain("| Token | Value |");
    // Chain references shown (but not the self-token in the table)
    expect(result?.value).toContain("--color-brand-primary");
    expect(result?.value).toContain("--color-palette-orange");
    // Intermediate step shows var() reference
    expect(result?.value).toContain("var(--color-palette-orange)");
    // Terminal step shows the literal value
    expect(result?.value).toContain("`#e95420`");
  });

  it("shows resolution table even for depth-1 tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--spacing-sm",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Single-step tokens still show the table
    expect(result?.value).toContain("| Token | Value |");
    expect(result?.value).toContain("`8px`");
  });

  it("shows tier information in provenance badge", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("Semantic");
  });

  it("shows source file location", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("color.tokens.json");
  });

  it("shows paired values in provenance line via light-dark()", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Paired values shown via light-dark() in provenance line
    expect(result?.value).toContain("light-dark(#ffffff, #1e1e1e)");
  });

  it("respects showProvenanceBadge=false", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const config = makeConfig({
      hover: {
        ...makeConfig().hover,
        showProvenanceBadge: false,
      },
    });

    const result = provideHover("--color-bg", "file:///a.css", graph, config);

    // The ● badge line should be absent
    expect(result?.value).not.toContain("\u25CF");
  });

  it("shows declaration sites with raw values and location", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--local-x",
      fileUri: "file:///button.css",
      line: 5,
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

    const result = provideHover(
      "--local-x",
      "file:///button.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    expect(result?.value).toContain(".button");
    expect(result?.value).toContain("12px"); // raw value shown
    expect(result?.value).toContain("button.css:6"); // 0-indexed + 1
  });

  it("shows multiple declaration sites with count", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--color-surface",
      fileUri: "file:///tokens.css",
      line: 10,
      column: 2,
      rawValue: "light-dark(#fff, #1e1e1e)",
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
      cssVar: "--color-surface",
      fileUri: "file:///modifiers.css",
      line: 5,
      column: 2,
      rawValue: "#2d2d2d",
      cssType: "<color>",
      selector: {
        selector: ".is-dark",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    });
    graph.addDeclaration({
      cssVar: "--color-surface",
      fileUri: "file:///surfaces.css",
      line: 3,
      column: 2,
      rawValue: "#f5f5f5",
      cssType: "<color>",
      selector: {
        selector: ".surface-muted",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    });

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    // Declaration sites rendered as table with ✓ for global selectors
    expect(result?.value).toContain("| Selector | Source |");
    expect(result?.value).toContain("\u2713"); // ✓ for :root
    expect(result?.value).toContain(":root");
    expect(result?.value).toContain("tokens.css:11");
    expect(result?.value).toContain(".is-dark");
    expect(result?.value).toContain("modifiers.css:6");
    expect(result?.value).toContain(".surface-muted");
    expect(result?.value).toContain("surfaces.css:4");
  });

  it("does not render Unicode block swatch characters", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Should NOT contain Unicode full block characters (they render
    // as text colour, not the token colour, in VS Code markdown)
    expect(result?.value).not.toContain("\u2588");
  });

  it("shows hex values for colour tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("#ffffff");
    expect(result?.value).toContain("#1e1e1e");
  });

  it("shows type in provenance line for artifact tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Provenance line: ● **Semantic `color`**
    expect(result?.value).toContain("Semantic");
    expect(result?.value).toContain("`color`");
  });

  // ─────────────────────────────────────────────────────────────
  // Vignelli: no code block — value in provenance line
  // ─────────────────────────────────────────────────────────────

  it("does not use fenced code blocks (value in provenance line)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // No code block — value is in the provenance line
    expect(result?.value).not.toContain("```css");
  });

  it("provenance line shows light-dark() for paired colour tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // light-dark() in provenance line, not a code block
    expect(result?.value).toContain("light-dark(#ffffff, #1e1e1e)");
    expect(result?.value).not.toContain("```css");
  });

  it("provenance line shows plain value for non-colour tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--spacing-sm",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Value directly in provenance line
    expect(result?.value).toContain("`8px`");
    expect(result?.value).not.toContain("```css");
  });

  it("local vars show value in provenance line", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--local-pad",
      fileUri: "file:///a.css",
      line: 2,
      column: 2,
      rawValue: "16px",
      cssType: "<length>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = provideHover(
      "--local-pad",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Value in provenance line, no code block
    expect(result?.value).toContain("`16px`");
    expect(result?.value).not.toContain("```css");
  });

  it("has single-flow layout without separator", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // No zone separator — single continuous flow
    expect(result?.value).not.toContain("\n\n---\n\n");
    // Provenance, description, and resolution table all present
    expect(result?.value).toContain("Semantic");
    expect(result?.value).toContain("Page background colour");
    expect(result?.value).toContain("| Token | Value |");
    // No code block
    expect(result?.value).not.toContain("```css");
  });

  it("omits checkmark for scoped declarations", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--scoped-var",
      fileUri: "file:///component.css",
      line: 3,
      column: 2,
      rawValue: "blue",
      cssType: "<color>",
      selector: {
        selector: ".card",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    });

    const result = provideHover(
      "--scoped-var",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    // Scoped declaration has no ✓ marker
    expect(result?.value).toContain(".card");
    expect(result?.value).not.toContain("\u2713");
  });

  // ─────────────────────────────────────────────────────────────
  // Resolution table — paired tokens
  // ─────────────────────────────────────────────────────────────

  it("shows resolution table for semantic tokens with no chain", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Single-step tokens still show the table
    expect(result?.value).toContain("| Token | Value |");
    expect(result?.value).toContain("light-dark(");
  });

  it("resolution table shows L/D sub-rows for diverging paired tokens", () => {
    const graph = new TokenGraph();
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--color-surface": {
          id: "color.surface",
          type: "color",
          valueLight: "var(--color-palette-white)",
          valueDark: "var(--color-palette-gray-900)",
          isPaired: true,
          tier: "semantic",
        },
        "--color-palette-white": {
          id: "color.palette.white",
          type: "color",
          valueLight: "#ffffff",
          isPaired: false,
          tier: "primitive",
        },
        "--color-palette-gray-900": {
          id: "color.palette.gray.900",
          type: "color",
          valueLight: "#1a1a1a",
          isPaired: false,
          tier: "primitive",
        },
      },
    };
    loadArtifact(artifact, graph);

    const result = provideHover(
      "--color-surface",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Table shows the chain with L/D sub-rows at the terminal
    expect(result?.value).toContain("| Token | Value |");
    expect(result?.value).toContain("| 1L |");
    expect(result?.value).toContain("--color-palette-white");
    expect(result?.value).toContain("`#ffffff`");
    expect(result?.value).toContain("| 1D |");
    expect(result?.value).toContain("--color-palette-gray-900");
    expect(result?.value).toContain("`#1a1a1a`");
  });

  it("resolution table resolves via value-matching when literal values", () => {
    // Simulate Terrazzo output: semantic token has resolved literal value
    // matching a primitive (no var() reference).
    const graph = new TokenGraph();
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--color-border-branded": {
          id: "color.border.branded",
          type: "color",
          valueLight: "oklch(54.94% 0.1746 37.97)",
          valueDark: "oklch(54.94% 0.1746 37.97)",
          isPaired: false,
          tier: "semantic",
        },
        "--color-palette-orange-520": {
          id: "color.palette.orange.520",
          type: "color",
          valueLight: "oklch(54.94% 0.1746 37.97)",
          valueDark: "oklch(54.94% 0.1746 37.97)",
          isPaired: false,
          tier: "primitive",
        },
      },
    };
    loadArtifact(artifact, graph);

    const result = provideHover(
      "--color-border-branded",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // Should show a resolution table linking to the matching primitive
    expect(result?.value).toContain("| Token | Value |");
    expect(result?.value).toContain("--color-palette-orange-520");
    // Terminal step shows the resolved literal
    expect(result?.value).toContain("oklch(54.94% 0.1746 37.97)");
  });

  it("resolution table has clean rows without tier annotations", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // No tier annotations in table — tier is in provenance line only
    expect(result?.value).not.toContain("*(semantic)*");
    expect(result?.value).not.toContain("*(primitive)*");
    // Table rows show just Token / Value (self-row omitted)
    expect(result?.value).toContain(
      "| `--color-brand-primary` | `var(--color-palette-orange)` |",
    );
    expect(result?.value).toContain("| `--color-palette-orange` | `#e95420` |");
  });

  // ─────────────────────────────────────────────────────────────
  // Tier-specific badges
  // ─────────────────────────────────────────────────────────────

  it("uses ◇ badge for primitive tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--spacing-sm",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // ◇ for primitive
    expect(result?.value).toContain("\u25C7");
    expect(result?.value).toContain("Primitive");
  });

  it("uses ● badge for semantic tokens", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // ● for semantic
    expect(result?.value).toContain("\u25CF");
    expect(result?.value).toContain("Semantic");
  });

  it("uses ▲ badge for derived tokens", () => {
    const graph = new TokenGraph();
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--hover--color-fg": {
          id: null,
          type: "color",
          tier: "derived",
          isPaired: false,
          derivedFrom: "--color-fg",
          derivation: "hover",
          cssOutputFile: "/dist/states.css",
        },
        "--color-fg": {
          id: "color.foreground",
          type: "color",
          valueLight: "#111",
          valueDark: "#eee",
          isPaired: true,
          tier: "semantic",
        },
      },
    };
    loadArtifact(artifact, graph);

    const result = provideHover(
      "--hover--color-fg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    // ▲ for derived
    expect(result?.value).toContain("\u25B2");
    expect(result?.value).toContain("Derived");
  });

  // ─────────────────────────────────────────────────────────────
  // Derived token info
  // ─────────────────────────────────────────────────────────────

  it("shows derivation source and kind for derived tokens", () => {
    const graph = new TokenGraph();
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--hover--color-fg": {
          id: null,
          type: "color",
          tier: "derived",
          isPaired: false,
          derivedFrom: "--color-fg",
          derivation: "hover",
          cssOutputFile: "/dist/states.css",
        },
        "--color-fg": {
          id: "color.foreground",
          type: "color",
          valueLight: "#111",
          tier: "semantic",
        },
      },
    };
    loadArtifact(artifact, graph);

    const result = provideHover(
      "--hover--color-fg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("from `--color-fg`");
    expect(result?.value).toContain("hover state");
  });

  it("shows derivation info for delta tokens", () => {
    const graph = new TokenGraph();
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--delta-hover-color-fg": {
          id: null,
          type: "number",
          tier: "derived",
          isPaired: true,
          derivedFrom: "--color-fg",
          derivation: "delta",
          valueLight: "0.19",
          valueDark: "-0.04",
          cssOutputFile: "/dist/modifiers.theme.css",
        },
        "--color-fg": {
          id: "color.foreground",
          type: "color",
          valueLight: "#111",
          tier: "semantic",
        },
      },
    };
    loadArtifact(artifact, graph);

    const result = provideHover(
      "--delta-hover-color-fg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("from `--color-fg`");
    expect(result?.value).toContain("lightness delta");
    expect(result?.value).toContain("light-dark(0.19, -0.04)");
  });

  it("shows derivation source for channel tokens", () => {
    const graph = new TokenGraph();
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--modifier-color-border": {
          id: null,
          type: "color",
          tier: "semantic",
          isPaired: false,
          derivedFrom: "--color-border-branded",
          derivation: "channel-modifier",
          cssOutputFile: "/dist/modifiers.emphasis.css",
        },
        "--color-border-branded": {
          id: "color.border.branded",
          type: "color",
          valueLight: "#e95420",
          tier: "semantic",
        },
      },
    };
    loadArtifact(artifact, graph);

    const result = provideHover(
      "--modifier-color-border",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result?.value).toContain("from `--color-border-branded`");
    // Channel derivation kinds are not labelled — only the source is shown
    expect(result?.value).not.toContain("channel");
  });

  // ─────────────────────────────────────────────────────────────
  // Declaration sites with at-rule context
  // ─────────────────────────────────────────────────────────────

  it("shows at-rule context in declaration sites", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--color-bg",
      fileUri: "file:///theme.css",
      line: 8,
      column: 2,
      rawValue: "#1e1e1e",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [{ name: "media", prelude: "(prefers-color-scheme: dark)" }],
        scopeType: "media",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = provideHover(
      "--color-bg",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    expect(result?.value).toContain("@media (prefers-color-scheme: dark)");
    expect(result?.value).toContain(":root");
    expect(result?.value).toContain("theme.css:9");
  });

  it("deduplicates declarations sharing same file and line", () => {
    const graph = new TokenGraph();
    // Artifact-injected declaration: bare :root, no at-rules
    graph.addDeclaration({
      cssVar: "--color-border-muted",
      fileUri: "file:///modifiers.theme.css",
      line: 26,
      column: 0,
      rawValue: "",
      cssType: "<unknown>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });
    // CSS-scanned declaration: same line, but with @layer context
    graph.addDeclaration({
      cssVar: "--color-border-muted",
      fileUri: "file:///modifiers.theme.css",
      line: 26,
      column: 2,
      rawValue:
        "light-dark(var(--color-palette-gray-100), var(--color-palette-gray-820))",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [{ name: "layer", prelude: "ds.modifiers" }],
        scopeType: "layer",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = provideHover(
      "--color-border-muted",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    // Should show only one row, with the richer at-rule context
    const tableRows = result?.value
      .split("\n")
      .filter(
        (l) =>
          l.startsWith("| ") && !l.startsWith("| |") && !l.startsWith("|:"),
      );
    expect(tableRows).toHaveLength(1);
    // Layer appears in its own column, not inlined with selector
    expect(result?.value).toContain("| Layer |");
    expect(tableRows[0]).toContain("`ds.modifiers`");
    expect(tableRows[0]).toContain("modifiers.theme.css:27");
  });

  it("shows nested at-rules outermost-first", () => {
    const graph = new TokenGraph();
    graph.addDeclaration({
      cssVar: "--layer-var",
      fileUri: "file:///layers.css",
      line: 3,
      column: 2,
      rawValue: "red",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [
          { name: "media", prelude: "(min-width: 768px)" },
          { name: "layer", prelude: "components" },
        ],
        scopeType: "layer",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = provideHover(
      "--layer-var",
      "file:///a.css",
      graph,
      makeConfig(),
    );

    expect(result).not.toBeNull();
    // Layer is in its own column; @media stays in the selector cell
    expect(result?.value).toContain("| Layer |");
    expect(result?.value).toContain("`components`");
    expect(result?.value).toContain("@media (min-width: 768px)");
  });
});

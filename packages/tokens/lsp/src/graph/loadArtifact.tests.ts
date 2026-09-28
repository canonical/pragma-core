/**
 * Artifact loader tests — TDD red phase.
 *
 * Tests loading a tokens.json artifact and converting its entries
 * to TokenNode instances in a TokenGraph.
 *
 */
import { describe, expect, it } from "vitest";
import type { RawArtifact, RawArtifactToken } from "../types/index.js";
import loadArtifact from "./loadArtifact.js";
import parseArtifactToken from "./parseArtifactToken.js";
import TokenGraph from "./TokenGraph.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeArtifact(tokens: Record<string, RawArtifactToken>): RawArtifact {
  return {
    version: "1.0.0",
    generator: "@terrazzo/plugin-css@4.1.0",
    tokens,
  };
}

const SEMANTIC_COLOR: RawArtifactToken = {
  id: "color.background",
  type: "color",
  tier: "semantic",
  value: "light-dark(oklch(100% 0 0), oklch(12.21% 0 0))",
  valueLight: "oklch(100% 0 0)",
  valueDark: "oklch(12.21% 0 0)",
  isPaired: true,
  description: "Page-level background surface",
  sourceFile: "/home/user/project/tokens/semantic/color.tokens.json",
  sourceLine: 88,
  aliasChain: [],
  extensions: {},
  registered: true,
  syntax: "<color>",
  inherits: true,
  initialValue: "oklch(0% 0 0)",
  cssOutputFile: "tokens.css",
  cssOutputLine: 89,
};

const DIMENSION_TOKEN: RawArtifactToken = {
  id: "spacing.layout.page.padding",
  type: "dimension",
  tier: "semantic",
  value: "24px",
  valueLight: "24px",
  valueDark: "24px",
  isPaired: false,
  description: "Outer horizontal padding",
  sourceFile: "/home/user/project/tokens/semantic/spacing.tokens.json",
  sourceLine: 34,
  aliasChain: ["dimension.space.600"],
  extensions: {},
  registered: false,
  syntax: null,
  inherits: null,
  initialValue: null,
  cssOutputFile: "tokens.css",
  cssOutputLine: 143,
};

const DERIVED_TOKEN: RawArtifactToken = {
  id: null,
  type: "color",
  tier: "derived",
  derivedFrom: "--color-foreground-primary",
  derivation: "hover",
  value:
    "oklch(from var(--modifier-color-foreground-primary) calc(l + var(--delta-hover-foreground-primary)) c h)",
  valueLight: undefined,
  valueDark: undefined,
  isPaired: false,
  description: "Hover state for foreground.primary",
  sourceFile: undefined,
  sourceLine: undefined,
  aliasChain: [],
  extensions: {},
  registered: false,
  syntax: null,
  inherits: null,
  initialValue: null,
  cssOutputFile: "states.css",
  cssOutputLine: 4,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseArtifactToken", () => {
  it("parses a semantic color token", () => {
    const node = parseArtifactToken("--color-background", SEMANTIC_COLOR);

    expect(node.cssVar).toBe("--color-background");
    expect(node.id).toBe("color.background");
    expect(node.type).toBe("color");
    expect(node.tier).toBe("semantic");
    expect(node.cssType).toBe("<color>");
    expect(node.valueLight).toBe("oklch(100% 0 0)");
    expect(node.valueDark).toBe("oklch(12.21% 0 0)");
    expect(node.isPaired).toBe(true);
    expect(node.description).toBe("Page-level background surface");
    expect(node.registered).toBe(true);
    expect(node.syntax).toBe("<color>");
    expect(node.inherits).toBe(true);
    expect(node.initialValue).toBe("oklch(0% 0 0)");
    expect(node.sourceFile).toBe(
      "/home/user/project/tokens/semantic/color.tokens.json",
    );
    expect(node.sourceLine).toBe(88);
    expect(node.cssOutputFile).toBe("tokens.css");
    expect(node.cssOutputLine).toBe(89);
    expect(node.aliasChain).toEqual([]);
    expect(node.isPrimary).toBe(true);
    expect(node.provenance).toEqual({
      kind: "artifact",
      packageSource: "",
    });
  });

  it("parses a dimension token with alias chain", () => {
    const node = parseArtifactToken(
      "--spacing-layout-page-padding",
      DIMENSION_TOKEN,
    );

    expect(node.cssVar).toBe("--spacing-layout-page-padding");
    expect(node.type).toBe("dimension");
    expect(node.cssType).toBe("<length>");
    expect(node.aliasChain).toEqual(["dimension.space.600"]);
    expect(node.isPrimary).toBe(false);
    expect(node.isPaired).toBe(false);
    expect(node.valueLight).toBe("24px");
    expect(node.valueDark).toBe("24px");
  });

  it("parses a derived token with null id", () => {
    const node = parseArtifactToken(
      "--hover--color-foreground-primary",
      DERIVED_TOKEN,
    );

    expect(node.cssVar).toBe("--hover--color-foreground-primary");
    expect(node.id).toBe("");
    expect(node.tier).toBe("derived");
    expect(node.derivedFrom).toBe("--color-foreground-primary");
    expect(node.derivation).toBe("hover");
    expect(node.sourceFile).toBeNull();
    // valueLight falls back to raw.value when raw.valueLight is undefined
    expect(node.valueLight).toBe(DERIVED_TOKEN.value);
  });
});

describe("loadArtifact", () => {
  it("loads all tokens including derived into a TokenGraph", () => {
    const artifact = makeArtifact({
      "--color-background": SEMANTIC_COLOR,
      "--spacing-layout-page-padding": DIMENSION_TOKEN,
      "--hover--color-foreground-primary": DERIVED_TOKEN,
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    expect(graph.tokenCount).toBe(3);
    expect(graph.resolveToken("--color-background")).not.toBeNull();
    expect(graph.resolveToken("--spacing-layout-page-padding")).not.toBeNull();
    expect(
      graph.resolveToken("--hover--color-foreground-primary"),
    ).not.toBeNull();
  });

  it("loads derived-tier tokens (modifier/state tokens)", () => {
    const artifact = makeArtifact({
      "--hover--color-foreground-primary": DERIVED_TOKEN,
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    expect(graph.tokenCount).toBe(1);
    const token = graph.resolveToken("--hover--color-foreground-primary");
    expect(token).not.toBeNull();
    expect(token?.tier).toBe("derived");
    expect(token?.derivedFrom).toBe("--color-foreground-primary");
  });

  it("registers all cssVars in allVars", () => {
    const artifact = makeArtifact({
      "--color-background": SEMANTIC_COLOR,
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    expect(graph.hasVar("--color-background")).toBe(true);
  });

  it("handles an empty artifact", () => {
    const artifact = makeArtifact({});
    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    expect(graph.tokenCount).toBe(0);
  });

  it("sets provenance to artifact for all loaded tokens", () => {
    const artifact = makeArtifact({
      "--color-background": SEMANTIC_COLOR,
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const token = graph.resolveToken("--color-background");
    expect(token?.provenance.kind).toBe("artifact");
  });

  // ─────────────────────────────────────────────────────────────
  // buildAliasChains (post-pass)
  // ─────────────────────────────────────────────────────────────

  it("builds alias chains from var() references", () => {
    const artifact = makeArtifact({
      "--color-bg": {
        id: "color.bg",
        type: "color",
        tier: "semantic",
        valueLight: "var(--color-brand)",
        valueDark: "var(--color-brand)",
      },
      "--color-brand": {
        id: "color.brand",
        type: "color",
        tier: "semantic",
        valueLight: "var(--color-palette-orange)",
        valueDark: "var(--color-palette-orange)",
      },
      "--color-palette-orange": {
        id: "color.palette.orange",
        type: "color",
        tier: "primitive",
        valueLight: "#e95420",
        valueDark: "#e95420",
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const token = graph.resolveToken("--color-bg");
    expect(token?.aliasChain).toEqual([
      "--color-brand",
      "--color-palette-orange",
    ]);
    expect(token?.isPrimary).toBe(false);
  });

  it("leaves literal-value tokens with empty alias chains", () => {
    const artifact = makeArtifact({
      "--spacing-sm": {
        id: "spacing.sm",
        type: "dimension",
        tier: "primitive",
        valueLight: "8px",
        valueDark: "8px",
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const token = graph.resolveToken("--spacing-sm");
    expect(token?.aliasChain).toEqual([]);
    expect(token?.isPrimary).toBe(true);
  });

  it("handles var() references to tokens not in the graph", () => {
    const artifact = makeArtifact({
      "--color-bg": {
        id: "color.bg",
        type: "color",
        tier: "semantic",
        valueLight: "var(--unknown-token)",
        valueDark: "var(--unknown-token)",
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const token = graph.resolveToken("--color-bg");
    // Chain stops at the unknown reference
    expect(token?.aliasChain).toEqual(["--unknown-token"]);
    expect(token?.isPrimary).toBe(false);
  });

  it("builds alias chains via value-matching for resolved literals", () => {
    const artifact = makeArtifact({
      "--color-border-branded": {
        id: "color.border.branded",
        type: "color",
        tier: "semantic",
        valueLight: "oklch(54.94% 0.1746 37.97)",
        valueDark: "oklch(54.94% 0.1746 37.97)",
      },
      "--color-palette-orange-520": {
        id: "color.palette.orange.520",
        type: "color",
        tier: "primitive",
        valueLight: "oklch(54.94% 0.1746 37.97)",
        valueDark: "oklch(54.94% 0.1746 37.97)",
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const token = graph.resolveToken("--color-border-branded");
    // Should find the primitive via value-matching
    expect(token?.aliasChain).toEqual(["--color-palette-orange-520"]);
    expect(token?.isPrimary).toBe(false);
  });

  it("does not value-match primitives to themselves", () => {
    const artifact = makeArtifact({
      "--color-palette-orange-520": {
        id: "color.palette.orange.520",
        type: "color",
        tier: "primitive",
        valueLight: "oklch(54.94% 0.1746 37.97)",
        valueDark: "oklch(54.94% 0.1746 37.97)",
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const token = graph.resolveToken("--color-palette-orange-520");
    // Primitive should not alias to itself
    expect(token?.aliasChain).toEqual([]);
    expect(token?.isPrimary).toBe(true);
  });

  it("injects artifact declarations into the graph", () => {
    const artifact = makeArtifact({
      "--modifier-color-text": {
        id: null,
        type: "color",
        tier: "semantic",
        valueLight: "var(--color-text-branded)",
        valueDark: "var(--color-text-branded)",
        derivedFrom: "--color-text-branded",
        derivation: "channel-modifier",
        declarations: [
          {
            selector: ".constructive",
            file: "modifiers.anticipation.css",
            line: 5,
          },
          {
            selector: ".destructive",
            file: "modifiers.anticipation.css",
            line: 12,
          },
          { selector: ":root", file: "modifiers.theme.css", line: 3 },
        ],
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const decls = graph.getDeclarations("--modifier-color-text");
    expect(decls).toBeDefined();
    expect(decls).toHaveLength(3);
    expect(decls?.[0].selector.selector).toBe(".constructive");
    expect(decls?.[0].line).toBe(5);
    expect(decls?.[1].selector.selector).toBe(".destructive");
    expect(decls?.[1].line).toBe(12);
    expect(decls?.[2].selector.selector).toBe(":root");
    expect(decls?.[2].selector.scopeType).toBe("global");
  });

  it("passes at-rule context through from artifact declarations", () => {
    const artifact = makeArtifact({
      "--color-bg": {
        id: "color.bg",
        type: "color",
        tier: "semantic",
        valueLight: "oklch(100% 0 0)",
        declarations: [
          {
            selector: ":root",
            file: "modifiers.theme.css",
            line: 26,
            atRules: [{ name: "layer", prelude: "ds.modifiers" }],
          },
        ],
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const decls = graph.getDeclarations("--color-bg");
    expect(decls).toHaveLength(1);
    expect(decls?.[0].selector.atRules).toEqual([
      { name: "layer", prelude: "ds.modifiers" },
    ]);
  });

  it("registers artifact file URIs in artifactFileUris", () => {
    const artifact = makeArtifact({
      "--color-bg": {
        id: "color.bg",
        type: "color",
        tier: "semantic",
        valueLight: "oklch(100% 0 0)",
        declarations: [
          {
            selector: ":root",
            file: "modifiers.theme.css",
            line: 26,
          },
        ],
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph, "", "/project/dist");

    expect(
      graph.isArtifactFile("file:///project/dist/modifiers.theme.css"),
    ).toBe(true);
  });

  it("guards against circular var() references", () => {
    const artifact = makeArtifact({
      "--a": {
        id: "a",
        type: "color",
        tier: "semantic",
        valueLight: "var(--b)",
        valueDark: "var(--b)",
      },
      "--b": {
        id: "b",
        type: "color",
        tier: "semantic",
        valueLight: "var(--a)",
        valueDark: "var(--a)",
      },
    });

    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const tokenA = graph.resolveToken("--a");
    // Should not loop forever; chain walks --b then detects --a is circular
    expect(tokenA?.aliasChain).toEqual(["--b", "--a"]);
  });
});

/**
 * Completion provider tests — TDD.
 *
 * Tests import-graph-scoped completions with provenance badges,
 * sort ordering, and context-aware type prioritization.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, ReachabilityCache, TokenGraph } from "../graph/index.js";
import { makeConfig } from "../testing/index.js";
import type { CompletionItem, RawArtifact } from "../types/index.js";
import {
  provideCompletions,
  resolveCompletionItem,
} from "./completions/index.js";

const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-bg": {
      id: "color.background",
      type: "color",
      value: "#fff",
      valueLight: "#fff",
      valueDark: "#1e1e1e",
      isPaired: true,
      description: "Page background",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
    },
    "--spacing-sm": {
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      description: "Small spacing",
      tier: "primitive",
      cssOutputFile: "/dist/tokens.css",
    },
  },
};

/** Extended artifact with more types and tiers for sorting tests. */
const RICH_ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-primary": {
      id: "color.primary",
      type: "color",
      value: "#0066cc",
      valueLight: "#0066cc",
      description: "Primary brand colour",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
    },
    "--color-palette-blue-500": {
      id: "color.palette.blue.500",
      type: "color",
      value: "#0066cc",
      valueLight: "#0066cc",
      description: "Blue 500",
      tier: "primitive",
      cssOutputFile: "/dist/tokens.css",
    },
    "--spacing-md": {
      id: "spacing.md",
      type: "dimension",
      value: "16px",
      description: "Medium spacing",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
    },
    "--spacing-base": {
      id: "spacing.base",
      type: "dimension",
      value: "8px",
      description: "Base spacing unit",
      tier: "primitive",
      cssOutputFile: "/dist/tokens.css",
    },
    "--font-size-body": {
      id: "typography.body.size",
      type: "dimension",
      value: "1rem",
      description: "Body font size",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
    },
    "--font-weight-bold": {
      id: "typography.weight.bold",
      type: "fontWeight",
      value: "700",
      description: "Bold weight",
      tier: "semantic",
      cssOutputFile: "/dist/tokens.css",
    },
  },
};

// ---------------------------------------------------------------------------
// Tests — basic behaviour (backward-compatible)
// ---------------------------------------------------------------------------

describe("provideCompletions", () => {
  it("does not offer internal artifact channels", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(
      {
        "--internal-channel": {
          id: null,
          type: "dimension",
          tier: "derived",
          visibility: "internal",
          cssOutputFile: "/dist/tokens.css",
        },
        "--public-space": {
          id: "spacing.component.gap",
          type: "dimension",
          tier: "semantic",
          visibility: "public",
          cssOutputFile: "/dist/tokens.css",
        },
      } as RawArtifact,
      graph,
    );

    const labels = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    ).map((item) => item.label);
    expect(labels).toContain("--public-space");
    expect(labels).not.toContain("--internal-channel");
  });

  it("includes artifact tokens in completions", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const labels = items.map((i) => i.label);
    expect(labels).toContain("--color-bg");
    expect(labels).toContain("--spacing-sm");
  });

  it("sorts artifact tokens before local tokens", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    // Add a local declaration
    graph.addDeclaration({
      cssVar: "--local-pad",
      fileUri: "file:///a.css",
      line: 5,
      column: 2,
      rawValue: "12px",
      cssType: "<length>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    const localItem = items.find((i) => i.label === "--local-pad");

    expect(bgItem?.sortText).toBeDefined();
    expect(localItem?.sortText).toBeDefined();
    // Artifact sorts before local (without context, both get "1" prefix)
    expect((bgItem?.sortText ?? "") < (localItem?.sortText ?? "")).toBe(true);
  });

  it("includes provenance badge in detail", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    // ● badge for artifact
    expect(bgItem?.detail).toContain("\u25CF");
  });

  it("insertText closes var() via snippet format", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    // Snippet appends closing paren and places cursor via $0
    expect(bgItem?.insertText).toBe("--color-bg)$0");
    expect(bgItem?.insertTextFormat).toBe(2); // InsertTextFormat.Snippet
  });

  it("does not add a duplicate closing paren when one already follows", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
      ".foo {\n  margin: var(--);\n}",
      { line: 1, character: 16 },
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    expect(bgItem?.insertText).toBe("--color-bg$0");
  });

  it("does not add a closing paren before an existing fallback", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
      ".foo {\n  margin: var(--, 1rem);\n}",
      { line: 1, character: 16 },
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    expect(bgItem?.insertText).toBe("--color-bg$0");
  });

  it("uses Color kind for colour tokens", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    expect(bgItem?.kind).toBe(16); // CompletionItemKind.Color
  });

  it("excludes declarations not reachable from the open file", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    // Add a declaration in an unreachable file
    graph.addDeclaration({
      cssVar: "--unreachable-var",
      fileUri: "file:///other.css",
      line: 1,
      column: 2,
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

    // file:///a.css does NOT import file:///other.css
    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig({ globalStylesheets: [] }),
    );

    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("--unreachable-var");
  });

  it("includes declarations reachable via import graph", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    // Set up import edge: a.css -> b.css
    graph.addImport("file:///a.css", "file:///b.css");
    graph.addDeclaration({
      cssVar: "--imported-var",
      fileUri: "file:///b.css",
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

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig({ globalStylesheets: [] }),
    );

    const labels = items.map((i) => i.label);
    expect(labels).toContain("--imported-var");
  });

  it("includes artifact tokens reachable via global stylesheets", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(
      {
        ...ARTIFACT,
        tokens: {
          "--color-bg": {
            ...ARTIFACT.tokens["--color-bg"],
            cssOutputFile: "/dist/tokens.css",
          },
        },
      },
      graph,
    );

    // No import graph, but artifact-derived globalStylesheets (null = auto)
    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig({ globalStylesheets: null }),
    );

    const labels = items.map((i) => i.label);
    expect(labels).toContain("--color-bg");
  });

  it("always includes artifact tokens regardless of globalStylesheets", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(
      {
        ...ARTIFACT,
        tokens: {
          "--color-bg": {
            ...ARTIFACT.tokens["--color-bg"],
            cssOutputFile: "/dist/tokens.css",
          },
        },
      },
      graph,
    );

    // Even with explicit empty globalStylesheets and no import,
    // artifact tokens should still be offered — they represent the
    // design system and should be universally available.
    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig({ globalStylesheets: [] }),
    );

    const labels = items.map((i) => i.label);
    expect(labels).toContain("--color-bg");
  });

  // ─────────────────────────────────────────────────────────────
  // S-grade: completion documentation
  // ─────────────────────────────────────────────────────────────

  it("provides documentation without duplicate provenance (detail has it)", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    expect(bgItem).toBeDefined();
    // Documentation is added lazily on resolve, not in the initial list.
    expect(bgItem?.documentation).toBeUndefined();
    const resolved = resolveCompletionItem(
      bgItem as CompletionItem,
      "file:///a.css",
      graph,
      makeConfig(),
    );
    expect(resolved.documentation).toBeDefined();
    // Documentation should NOT contain provenance badge — detail already has it
    expect(resolved.documentation?.value).not.toContain("\u25CF");
    // But should contain the description
    expect(resolved.documentation?.value).toContain("Page background");
  });

  it("completion docs include description and metadata", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    const resolved = resolveCompletionItem(
      bgItem as CompletionItem,
      "file:///a.css",
      graph,
      makeConfig(),
    );
    // Completion docs include description
    expect(resolved.documentation?.value).toContain("Page background");
    // --color-bg is semantic with no chain — table still shown for single items
    expect(resolved.documentation?.value).toContain("| Token | Value |");
    // Provenance is in detail, not documentation
    expect(resolved.documentation?.value).not.toContain("\u25CF");
  });

  it("completion docs include resolution table when alias chain exists", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    // Use an artifact with a var() chain
    const chainArtifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--color-bg": {
          id: "color.background",
          type: "color",
          value: "#e95420",
          valueLight: "var(--color-palette-orange)",
          description: "Page background",
          tier: "semantic",
          cssOutputFile: "/dist/tokens.css",
        },
        "--color-palette-orange": {
          id: "color.palette.orange",
          type: "color",
          value: "#e95420",
          valueLight: "#e95420",
          tier: "primitive",
          cssOutputFile: "/dist/tokens.css",
        },
      },
    };
    loadArtifact(chainArtifact, graph);

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig(),
    );

    const bgItem = items.find((i) => i.label === "--color-bg");
    const resolved = resolveCompletionItem(
      bgItem as CompletionItem,
      "file:///a.css",
      graph,
      makeConfig(),
    );
    expect(resolved.documentation?.value).toContain("| Token | Value |");
    expect(resolved.documentation?.value).toContain("--color-palette-orange");
  });

  it("provides documentation for local declarations too", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    graph.addImport("file:///a.css", "file:///b.css");
    graph.addDeclaration({
      cssVar: "--local-size",
      fileUri: "file:///b.css",
      line: 1,
      column: 2,
      rawValue: "24px",
      cssType: "<length>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const items = provideCompletions(
      "file:///a.css",
      graph,
      cache,
      makeConfig({ globalStylesheets: [] }),
    );

    const localItem = items.find((i) => i.label === "--local-size");
    const resolvedLocal = resolveCompletionItem(
      localItem as CompletionItem,
      "file:///a.css",
      graph,
      makeConfig({ globalStylesheets: [] }),
    );
    expect(resolvedLocal.documentation).toBeDefined();
    // Documentation shows declaration sites (provenance is in detail)
    expect(resolvedLocal.documentation?.value).toContain(":root");
    expect(resolvedLocal.documentation?.value).toContain("b.css:2");
    expect(resolvedLocal.documentation?.value).not.toContain("```css");
  });

  // ─────────────────────────────────────────────────────────────
  // Context-aware type prioritization
  // ─────────────────────────────────────────────────────────────

  describe("context-aware sorting", () => {
    it("prioritizes dimension tokens for padding-left", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const source = ".foo {\n  padding-left: var(--);\n}";
      const position = { line: 1, character: 18 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      const spacingMd = items.find((i) => i.label === "--spacing-md");
      const colorPrimary = items.find((i) => i.label === "--color-primary");

      expect(spacingMd?.sortText).toBeDefined();
      expect(colorPrimary?.sortText).toBeDefined();
      // Dimension token sorts before color token in padding context
      expect((spacingMd?.sortText ?? "") < (colorPrimary?.sortText ?? "")).toBe(
        true,
      );
    });

    it("prioritizes color tokens for background-color", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const source = ".foo {\n  background-color: var(--);\n}";
      const position = { line: 1, character: 22 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      const colorPrimary = items.find((i) => i.label === "--color-primary");
      const spacingMd = items.find((i) => i.label === "--spacing-md");

      expect(colorPrimary?.sortText).toBeDefined();
      expect(spacingMd?.sortText).toBeDefined();
      // Color token sorts before dimension token in background-color context
      expect((colorPrimary?.sortText ?? "") < (spacingMd?.sortText ?? "")).toBe(
        true,
      );
    });

    it("prioritizes semantic over primitive within matching type", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const source = ".foo {\n  margin: var(--);\n}";
      const position = { line: 1, character: 12 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      const semantic = items.find((i) => i.label === "--spacing-md");
      const primitive = items.find((i) => i.label === "--spacing-base");

      expect(semantic?.sortText).toBeDefined();
      expect(primitive?.sortText).toBeDefined();
      // Semantic dimension sorts before primitive dimension
      expect((semantic?.sortText ?? "") < (primitive?.sortText ?? "")).toBe(
        true,
      );
    });

    it("treats all tokens neutrally when property is unknown", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      // No source/position = no context
      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
      );

      // All artifact items should have the same context prefix ("1" = neutral)
      for (const item of items) {
        expect(item.sortText?.startsWith("1_")).toBe(true);
      }
    });

    it("matching local declarations sort before non-matching artifacts", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      // Add a local <length> declaration
      graph.addDeclaration({
        cssVar: "--local-gap",
        fileUri: "file:///a.css",
        line: 1,
        column: 2,
        rawValue: "20px",
        cssType: "<length>",
        selector: {
          selector: ":root",
          atRules: [],
          scopeType: "global",
          isGlobal: true,
          isScoped: false,
        },
      });

      const source = ".foo {\n  gap: var(--);\n}";
      const position = { line: 1, character: 9 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      const localGap = items.find((i) => i.label === "--local-gap");
      const colorPrimary = items.find((i) => i.label === "--color-primary");

      expect(localGap?.sortText).toBeDefined();
      expect(colorPrimary?.sortText).toBeDefined();
      // Local <length> in gap context sorts before artifact <color>
      expect((localGap?.sortText ?? "") < (colorPrimary?.sortText ?? "")).toBe(
        true,
      );
    });

    it("matching artifacts sort before matching locals", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      // Add a local <length> declaration
      graph.addDeclaration({
        cssVar: "--local-gap",
        fileUri: "file:///a.css",
        line: 1,
        column: 2,
        rawValue: "20px",
        cssType: "<length>",
        selector: {
          selector: ":root",
          atRules: [],
          scopeType: "global",
          isGlobal: true,
          isScoped: false,
        },
      });

      const source = ".foo {\n  gap: var(--);\n}";
      const position = { line: 1, character: 9 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      const spacingMd = items.find((i) => i.label === "--spacing-md");
      const localGap = items.find((i) => i.label === "--local-gap");

      expect(spacingMd?.sortText).toBeDefined();
      expect(localGap?.sortText).toBeDefined();
      // Artifact <length> sorts before local <length> (both match context)
      expect((spacingMd?.sortText ?? "") < (localGap?.sortText ?? "")).toBe(
        true,
      );
    });

    it("all tokens still appear (nothing filtered out)", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const source = ".foo {\n  color: var(--);\n}";
      const position = { line: 1, character: 11 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      // All 6 tokens from RICH_ARTIFACT should be present
      const labels = items.map((i) => i.label);
      expect(labels).toContain("--color-primary");
      expect(labels).toContain("--color-palette-blue-500");
      expect(labels).toContain("--spacing-md");
      expect(labels).toContain("--spacing-base");
      expect(labels).toContain("--font-size-body");
      expect(labels).toContain("--font-weight-bold");
    });

    it("handles shorthand properties as neutral context", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const source = ".foo {\n  border: var(--);\n}";
      const position = { line: 1, character: 12 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      // For shorthands, all items should get neutral "1" prefix
      for (const item of items) {
        expect(item.sortText?.startsWith("1_")).toBe(true);
      }
    });

    it("uses tier-specific badges in completion detail", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
      );

      const semanticItem = items.find((i) => i.label === "--color-primary");
      const primitiveItem = items.find(
        (i) => i.label === "--color-palette-blue-500",
      );

      // Semantic uses ● (filled circle)
      expect(semanticItem?.detail).toContain("\u25CF");
      expect(semanticItem?.detail).toContain("Semantic");
      // Primitive uses ◇ (open diamond)
      expect(primitiveItem?.detail).toContain("\u25C7");
      expect(primitiveItem?.detail).toContain("Primitive");
    });

    it("shows derivation kind in completion detail for derived tokens", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      const derivedArtifact: RawArtifact = {
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
            cssOutputFile: "/dist/tokens.css",
          },
        },
      };
      loadArtifact(derivedArtifact, graph);

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
      );

      const hoverItem = items.find((i) => i.label === "--hover--color-fg");
      // ▲ badge for derived
      expect(hoverItem?.detail).toContain("\u25B2");
      expect(hoverItem?.detail).toContain("Derived");
      // Shows derivation kind
      expect(hoverItem?.detail).toContain("hover");
    });

    it("font-size context matches dimension tokens", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();
      loadArtifact(RICH_ARTIFACT, graph);

      const source = ".foo {\n  font-size: var(--);\n}";
      const position = { line: 1, character: 15 };

      const items = provideCompletions(
        "file:///a.css",
        graph,
        cache,
        makeConfig(),
        source,
        position,
      );

      const fontSize = items.find((i) => i.label === "--font-size-body");
      const colorPrimary = items.find((i) => i.label === "--color-primary");

      expect(fontSize?.sortText).toBeDefined();
      expect(colorPrimary?.sortText).toBeDefined();
      // Dimension token sorts before color in font-size context
      expect((fontSize?.sortText ?? "") < (colorPrimary?.sortText ?? "")).toBe(
        true,
      );
    });
  });
});

/**
 * Integration tests — end-to-end scenarios with full realistic artifact
 * manifests, plausible configs, and multi-file import graphs.
 *
 * These tests exercise the full pipeline: artifact load → graph construction
 * → import graph → reachability → provenance → type checking — using
 * data that mirrors a real @canonical/design-tokens deployment.
 *
 */
import { describe, expect, it } from "vitest";
import {
  buildSelectorContext,
  extractCssImports,
  extractPackageName,
  isAssignable,
  isExternalPath,
  mapDtcgType,
} from "./css/index.js";
import { loadArtifact, ReachabilityCache, TokenGraph } from "./graph/index.js";
import { resolveConfig } from "./protocol/index.js";
import { classifyProvenance } from "./providers/index.js";
import type { RawArtifact, RawConfig } from "./types/index.js";

// ---------------------------------------------------------------------------
// Realistic artifact fixture — 15 tokens, mirroring @canonical/tokens output
// ---------------------------------------------------------------------------

const REALISTIC_ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "@canonical/terrazzo-plugin-css@0.0.1",
  tokens: {
    "--color-palette-black": {
      id: "color.palette.black",
      type: "color",
      tier: "primitive",
      value: "oklch(0% 0 0)",
      valueLight: "oklch(0% 0 0)",
      valueDark: "oklch(0% 0 0)",
      isPaired: false,
      description: "Primitive black",
      sourceFile:
        "/home/user/tokens/canonical/global/primitive/color.tokens.json",
      sourceLine: 5,
      aliasChain: [],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "sets.primitive.css",
      cssOutputLine: 3,
    },
    "--color-palette-aubergine-60": {
      id: "color.palette.aubergine.60",
      type: "color",
      tier: "primitive",
      value: "oklch(56.03% 0.1573 328.36)",
      valueLight: "oklch(56.03% 0.1573 328.36)",
      valueDark: "oklch(56.03% 0.1573 328.36)",
      isPaired: false,
      description: "Aubergine palette 60",
      sourceFile:
        "/home/user/tokens/canonical/global/primitive/color.tokens.json",
      sourceLine: 50,
      aliasChain: [],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "sets.primitive.css",
      cssOutputLine: 15,
    },
    "--color-background": {
      id: "color.background",
      type: "color",
      tier: "semantic",
      value: "light-dark(oklch(100% 0 0), oklch(12.21% 0 0))",
      valueLight: "oklch(100% 0 0)",
      valueDark: "oklch(12.21% 0 0)",
      isPaired: true,
      description: "Page-level background surface",
      sourceFile:
        "/home/user/tokens/canonical/global/semantic/color/light.tokens.json",
      sourceLine: 3,
      aliasChain: [],
      extensions: {},
      registered: true,
      syntax: "<color>",
      inherits: true,
      initialValue: "oklch(0% 0 0)",
      cssOutputFile: "modifiers.theme.css",
      cssOutputLine: 5,
    },
    "--color-foreground-primary": {
      id: "color.foreground.primary",
      type: "color",
      tier: "semantic",
      value: "light-dark(oklch(20% 0 0), oklch(95% 0 0))",
      valueLight: "oklch(20% 0 0)",
      valueDark: "oklch(95% 0 0)",
      isPaired: true,
      description: "Primary text colour",
      sourceFile:
        "/home/user/tokens/canonical/global/semantic/color/light.tokens.json",
      sourceLine: 10,
      aliasChain: [],
      extensions: {},
      registered: true,
      syntax: "<color>",
      inherits: true,
      initialValue: "oklch(0% 0 0)",
      cssOutputFile: "modifiers.theme.css",
      cssOutputLine: 8,
    },
    "--spacing-unit-1x": {
      id: "spacing.unit.1x",
      type: "dimension",
      tier: "primitive",
      value: "8px",
      valueLight: "8px",
      valueDark: "8px",
      isPaired: false,
      description: "Base spacing unit (8px grid)",
      sourceFile:
        "/home/user/tokens/canonical/global/primitive/dimension.tokens.json",
      sourceLine: 2,
      aliasChain: [],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "sets.primitive.css",
      cssOutputLine: 100,
    },
    "--spacing-layout-page-padding": {
      id: "spacing.layout.page.padding",
      type: "dimension",
      tier: "semantic",
      value: "24px",
      valueLight: "24px",
      valueDark: "24px",
      isPaired: false,
      description: "Outer horizontal padding for page-level containers",
      sourceFile:
        "/home/user/tokens/canonical/global/semantic/dimension/medium.tokens.json",
      sourceLine: 12,
      aliasChain: ["spacing.unit.3x"],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "sets.semantic.css",
      cssOutputLine: 2,
    },
    "--font-family-default": {
      id: "font.family.default",
      type: "fontFamily",
      tier: "semantic",
      value: "'Ubuntu', sans-serif",
      valueLight: "'Ubuntu', sans-serif",
      valueDark: "'Ubuntu', sans-serif",
      isPaired: false,
      description: "Default font family",
      sourceFile:
        "/home/user/tokens/canonical/global/primitive/typography.tokens.json",
      sourceLine: 4,
      aliasChain: [],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "modifiers.typography.css",
      cssOutputLine: 3,
    },
    "--modifier-color-foreground-primary": {
      id: null,
      type: "color",
      tier: "semantic",
      derivedFrom: "--color-foreground-primary",
      derivation: "channel-modifier",
      value: "var(--color-foreground-primary)",
      description: "Modifier channel for foreground.primary",
      sourceFile: undefined,
      sourceLine: undefined,
      aliasChain: [],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "modifiers.anticipation.css",
      cssOutputLine: 3,
    },
    "--hover--color-foreground-primary": {
      id: null,
      type: "color",
      tier: "derived",
      derivedFrom: "--color-foreground-primary",
      derivation: "hover",
      value:
        "oklch(from var(--modifier-color-foreground-primary, var(--color-foreground-primary)) calc(l + var(--delta-hover-foreground-primary)) c h)",
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
    },
    "--surface-color-background": {
      id: null,
      type: "color",
      tier: "semantic",
      derivedFrom: "--color-background",
      derivation: "channel-surface",
      value: "var(--color-background)",
      description: "Surface channel for background",
      sourceFile: undefined,
      sourceLine: undefined,
      aliasChain: [],
      extensions: {},
      registered: false,
      syntax: null,
      inherits: null,
      initialValue: null,
      cssOutputFile: "modifiers.surfaces.css",
      cssOutputLine: 3,
    },
  },
};

// ---------------------------------------------------------------------------
// Plausible import graph (CSS file structure)
// ---------------------------------------------------------------------------

const TOKENS_CSS_URI =
  "file:///project/node_modules/@canonical/tokens/dist/tokens.css";
const GLOBAL_CSS_URI = "file:///project/src/global.css";
const BUTTON_CSS_URI = "file:///project/src/components/Button/Button.css";
const BUTTON_LOCAL_URI =
  "file:///project/src/components/Button/Button.local.css";
const CARD_CSS_URI = "file:///project/src/components/Card/Card.css";

// ---------------------------------------------------------------------------
// Integration: full pipeline
// ---------------------------------------------------------------------------

describe("Integration: artifact load → graph → reachability", () => {
  function buildFullGraph(): TokenGraph {
    const graph = new TokenGraph();

    // 1. Load artifact
    loadArtifact(REALISTIC_ARTIFACT, graph);

    // 2. Add file nodes
    graph.addFile({
      uri: TOKENS_CSS_URI,
      path: "/project/node_modules/@canonical/tokens/dist/tokens.css",
      isExternal: true,
      packageName: "@canonical/tokens",
    });
    graph.addFile({
      uri: GLOBAL_CSS_URI,
      path: "/project/src/global.css",
      isExternal: false,
      packageName: null,
    });
    graph.addFile({
      uri: BUTTON_CSS_URI,
      path: "/project/src/components/Button/Button.css",
      isExternal: false,
      packageName: null,
    });
    graph.addFile({
      uri: BUTTON_LOCAL_URI,
      path: "/project/src/components/Button/Button.local.css",
      isExternal: false,
      packageName: null,
    });
    graph.addFile({
      uri: CARD_CSS_URI,
      path: "/project/src/components/Card/Card.css",
      isExternal: false,
      packageName: null,
    });

    // 3. Add import edges
    //   global.css → tokens.css
    //   Button.css → global.css, Button.local.css
    //   Card.css → (nothing — no import)
    graph.addImport(GLOBAL_CSS_URI, TOKENS_CSS_URI);
    graph.addImport(BUTTON_CSS_URI, GLOBAL_CSS_URI);
    graph.addImport(BUTTON_CSS_URI, BUTTON_LOCAL_URI);

    // 4. Add declarations from tokens.css (artifact CSS output)
    for (const [cssVar] of Object.entries(REALISTIC_ARTIFACT.tokens)) {
      graph.addDeclaration({
        cssVar,
        fileUri: TOKENS_CSS_URI,
        line: 0,
        column: 0,
        rawValue: "...",
        cssType: "<color>",
        selector: buildSelectorContext(":root", []),
      });
    }

    // 5. Add Button.local.css declarations (class-scoped)
    graph.addDeclaration({
      cssVar: "--button-padding",
      fileUri: BUTTON_LOCAL_URI,
      line: 2,
      column: 4,
      rawValue: "0.5rem 1rem",
      cssType: "<unknown>",
      selector: buildSelectorContext(".button", []),
    });

    return graph;
  }

  it("loads all tokens from the realistic artifact including derived", () => {
    const graph = buildFullGraph();
    // All 10 tokens loaded (including 3 derived-tier)
    expect(graph.tokenCount).toBe(10);
  });

  it("classifies primitive tokens correctly", () => {
    const graph = buildFullGraph();
    const black = graph.resolveToken("--color-palette-black");
    expect(black?.tier).toBe("primitive");
    expect(black?.cssType).toBe("<color>");
  });

  it("classifies semantic tokens correctly", () => {
    const graph = buildFullGraph();
    const bg = graph.resolveToken("--color-background");
    expect(bg?.tier).toBe("semantic");
    expect(bg?.isPaired).toBe(true);
    expect(bg?.registered).toBe(true);
    expect(bg?.syntax).toBe("<color>");
  });

  it("loads derived tokens with correct metadata", () => {
    const graph = buildFullGraph();
    const hover = graph.resolveToken("--hover--color-foreground-primary");
    expect(hover).not.toBeNull();
    expect(hover?.tier).toBe("derived");
    expect(hover?.derivedFrom).toBe("--color-foreground-primary");
    expect(hover?.derivation).toBe("hover");

    const modifier = graph.resolveToken("--modifier-color-foreground-primary");
    expect(modifier).not.toBeNull();
    expect(modifier?.tier).toBe("semantic");
    expect(modifier?.derivation).toBe("channel-modifier");

    const surface = graph.resolveToken("--surface-color-background");
    expect(surface).not.toBeNull();
    expect(surface?.tier).toBe("semantic");
    expect(surface?.derivation).toBe("channel-surface");
  });

  it("classifies dimension tokens with unit narrowing", () => {
    const graph = buildFullGraph();
    const spacing = graph.resolveToken("--spacing-unit-1x");
    expect(spacing?.cssType).toBe("<length>");
  });

  it("classifies fontFamily token type", () => {
    const graph = buildFullGraph();
    const font = graph.resolveToken("--font-family-default");
    expect(font?.cssType).toBe("<family-name>");
  });

  it("resolves alias chain for aliased tokens", () => {
    const graph = buildFullGraph();
    const padding = graph.resolveToken("--spacing-layout-page-padding");
    expect(padding?.aliasChain).toEqual(["spacing.unit.3x"]);
    expect(padding?.isPrimary).toBe(false);
  });

  describe("reachability via import graph", () => {
    it("Button.css can reach artifact tokens (via global.css → tokens.css)", () => {
      const graph = buildFullGraph();
      const cache = new ReachabilityCache();
      const vars = cache.getReachableVars(BUTTON_CSS_URI, graph);

      expect(vars.has("--color-background")).toBe(true);
      expect(vars.has("--color-foreground-primary")).toBe(true);
      expect(vars.has("--button-padding")).toBe(true);
    });

    it("Card.css cannot reach artifact tokens (no import chain)", () => {
      const graph = buildFullGraph();
      const cache = new ReachabilityCache();
      const vars = cache.getReachableVars(CARD_CSS_URI, graph);

      expect(vars.has("--color-background")).toBe(false);
      expect(vars.has("--button-padding")).toBe(false);
    });

    it("Card.css can reach artifact tokens via globalStylesheets", () => {
      const graph = buildFullGraph();
      const cache = new ReachabilityCache();
      const globals = new Set([TOKENS_CSS_URI]);
      const vars = cache.getReachableVars(CARD_CSS_URI, graph, globals);

      expect(vars.has("--color-background")).toBe(true);
    });
  });

  describe("provenance classification in context", () => {
    it("artifact tokens have artifact provenance", () => {
      const graph = buildFullGraph();
      const prov = classifyProvenance(
        "--color-background",
        graph,
        BUTTON_CSS_URI,
      );
      expect(prov.kind).toBe("artifact");
    });

    it("local declarations have local provenance", () => {
      const graph = buildFullGraph();
      const prov = classifyProvenance(
        "--button-padding",
        graph,
        BUTTON_CSS_URI,
      );
      expect(prov.kind).toBe("local");
    });

    it("unknown vars fall back to buffer-only local provenance", () => {
      const graph = buildFullGraph();
      const prov = classifyProvenance("--unknown-var", graph, CARD_CSS_URI);
      expect(prov).toEqual({
        kind: "local",
        fileUri: CARD_CSS_URI,
      });
    });
  });

  describe("CSS type assignability in context", () => {
    it("color token is not assignable to width property", () => {
      const bg = mapDtcgType("color");
      expect(isAssignable(bg, "<length-percentage>")).toBe(false);
    });

    it("dimension token (px) is assignable to width property", () => {
      const graph = buildFullGraph();
      const spacing = graph.resolveToken("--spacing-unit-1x");
      expect(isAssignable(spacing?.cssType, "<length-percentage>")).toBe(true);
    });

    it("@property-registered color token has correct CSS type", () => {
      const graph = buildFullGraph();
      const bg = graph.resolveToken("--color-background");
      expect(bg?.cssType).toBe("<color>");
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: config resolution with realistic configs
// ---------------------------------------------------------------------------

describe("Integration: config resolution", () => {
  it("resolves a minimal config with artifacts", () => {
    const config = resolveConfig(
      { artifacts: ["@canonical/tokens/dist/tokens.json"] },
      "/home/user/project",
    );
    expect(config.artifactPaths).toEqual([
      "/home/user/project/node_modules/@canonical/tokens/dist/tokens.json",
    ]);
    expect(config.globalStylesheets).toBeNull();
  });

  it("resolves a full terrazzo-lsp.config.json config", () => {
    const raw: RawConfig = {
      artifacts: ["./dist/tokens.json"],
      distDir: "./dist",
      scanGlobs: ["src/**/*.css", "src/**/*.scss"],
      globalStylesheets: [
        "node_modules/@canonical/tokens/dist/**/*.css",
        ".storybook/overrides.css",
      ],
      diagnostics: {
        unknownProperties: "off",
        missingFallback: "warning",
        typeMismatch: "error",
        unreachableToken: "warning",
        primitiveToken: "warning",
        scopedDeclaration: "warning",
        ignoreGlobs: ["**/vendor/**", "**/generated/**"],
      },
      hover: {
        showColourSwatches: true,
        showProvenanceBadge: true,
        showAliasChain: true,
        showSourceLocation: true,
      },
      inlayHints: {
        enabled: false,
      },
    };
    const config = resolveConfig(raw, "/home/user/project");

    expect(config.artifactPaths).toEqual([
      "/home/user/project/dist/tokens.json",
    ]);
    expect(config.distDir).toBe("/home/user/project/dist");
    expect(config.globalStylesheets).toEqual([
      "file:///home/user/project/node_modules/@canonical/tokens/dist/**/*.css",
      "file:///home/user/project/.storybook/overrides.css",
    ]);
    expect(config.diagnostics.get("css/unknown-var")).toBeNull();
    expect(config.diagnostics.get("css/type-mismatch")).toBe(1); // Error
    expect(config.diagnosticIgnoreGlobs).toEqual([
      "**/vendor/**",
      "**/generated/**",
    ]);
    expect(config.hover.showColourSwatches).toBe(true);
    expect(config.inlayHints.enabled).toBe(false);
  });

  it("resolves import-graph-only mode (globalStylesheets: [])", () => {
    const config = resolveConfig(
      {
        artifacts: ["./dist/tokens.json"],
        globalStylesheets: [],
      },
      "/project",
    );
    expect(config.globalStylesheets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration: CSS import extraction from realistic CSS
// ---------------------------------------------------------------------------

describe("Integration: CSS import extraction", () => {
  it("extracts imports from a realistic global.css", () => {
    const css = [
      '@import "../../node_modules/@canonical/tokens/dist/tokens.css";',
      '@import "./reset.css";',
      "",
      ":root {",
      "  color-scheme: light dark;",
      "}",
    ].join("\n");

    const imports = extractCssImports(css);
    expect(imports).toEqual([
      "../../node_modules/@canonical/tokens/dist/tokens.css",
      "./reset.css",
    ]);
  });

  it("extracts imports from a component CSS file", () => {
    const css = [
      '@import "../../global.css";',
      '@import "./Button.local.css";',
      "",
      ".ds.button {",
      "  background: var(--color-background);",
      "  padding: var(--button-padding);",
      "}",
    ].join("\n");

    const imports = extractCssImports(css);
    expect(imports).toEqual(["../../global.css", "./Button.local.css"]);
  });

  it("detects external packages from paths", () => {
    const path = "/project/node_modules/@canonical/tokens/dist/tokens.css";
    expect(isExternalPath(path)).toBe(true);
    expect(extractPackageName(path)).toBe("@canonical/tokens");
  });
});

// ---------------------------------------------------------------------------
// Integration: selector scope in realistic contexts
// ---------------------------------------------------------------------------

describe("Integration: selector scope classification", () => {
  it("classifies token CSS output as global (:root)", () => {
    const ctx = buildSelectorContext(":root", []);
    expect(ctx.scopeType).toBe("global");
    expect(ctx.isGlobal).toBe(true);
  });

  it("classifies modifier output as class-scoped", () => {
    const ctx = buildSelectorContext(".constructive", []);
    expect(ctx.scopeType).toBe("class");
    expect(ctx.isScoped).toBe(true);
  });

  it("classifies surface layer output as class-scoped", () => {
    const ctx = buildSelectorContext(".surface", []);
    expect(ctx.scopeType).toBe("class");
    expect(ctx.isScoped).toBe(true);
  });

  it("classifies state derivation output as universal", () => {
    const ctx = buildSelectorContext("*", []);
    expect(ctx.scopeType).toBe("universal");
    expect(ctx.isGlobal).toBe(true);
  });

  it("classifies theme media query as media-scoped", () => {
    const ctx = buildSelectorContext(":root", [
      { name: "media", prelude: "(prefers-color-scheme: dark)" },
    ]);
    expect(ctx.scopeType).toBe("media");
    expect(ctx.isScoped).toBe(true);
  });

  it("classifies @layer-wrapped tokens as layer-scoped", () => {
    const ctx = buildSelectorContext(":root", [
      { name: "layer", prelude: "ds.tokens" },
    ]);
    expect(ctx.scopeType).toBe("layer");
  });
});

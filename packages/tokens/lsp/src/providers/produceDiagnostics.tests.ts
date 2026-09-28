/**
 * Diagnostics provider tests — TDD.
 *
 * Tests diagnostic generation: css/type-mismatch, css/missing-fallback,
 * css/unreachable-token, css/primitive-token, css/scoped-usage.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, ReachabilityCache, TokenGraph } from "../graph/index.js";
import { makeConfig } from "../testing/index.js";
import { DiagnosticSeverity, type RawArtifact } from "../types/index.js";
import { produceDiagnostics } from "./diagnostics/index.js";

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
      description: "Foreground colour",
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
      registered: false,
    },
    "--color-raw-blue": {
      id: "color.raw.blue",
      type: "color",
      value: "#0000ff",
      description: "Raw blue",
      tier: "primitive",
      cssOutputFile: "/project/dist/tokens.css",
    },
    "--spacing-sm": {
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("produceDiagnostics", () => {
  it("produces no diagnostics for clean CSS", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);

    // File that imports tokens
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `.box { color: var(--color-fg, #000); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    // No type mismatch, has fallback, is reachable
    const errors = diags.filter((d) => d.code === "css/type-mismatch");
    expect(errors).toHaveLength(0);
  });

  it("fires css/type-mismatch for colour token used as width", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `.box { width: var(--color-fg); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const mismatch = diags.filter((d) => d.code === "css/type-mismatch");
    expect(mismatch.length).toBeGreaterThan(0);
    expect(mismatch[0].severity).toBe(DiagnosticSeverity.Error);
  });

  it("does NOT fire css/type-mismatch inside calc()", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `.box { width: calc(100% - var(--color-fg)); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const mismatch = diags.filter((d) => d.code === "css/type-mismatch");
    expect(mismatch).toHaveLength(0);
  });

  it("fires css/missing-fallback for non-artifact var without fallback", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    // A locally-declared (non-artifact) custom property — no fallback should warn
    graph.addDeclaration({
      cssVar: "--local-pad",
      fileUri: "file:///theme.css",
      line: 1,
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
    graph.addImport("file:///a.css", "file:///theme.css");

    const source = `.box { padding: var(--local-pad); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const missing = diags.filter((d) => d.code === "css/missing-fallback");
    expect(missing.length).toBeGreaterThan(0);
  });

  it("does NOT fire css/missing-fallback for artifact tokens", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    // --color-fg is an artifact token — no fallback is expected
    const source = `.box { color: var(--color-fg); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const missing = diags.filter((d) => d.code === "css/missing-fallback");
    expect(missing).toHaveLength(0);
  });

  it("does NOT fire css/missing-fallback for registered tokens", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `.box { color: var(--color-registered); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const missing = diags.filter((d) => d.code === "css/missing-fallback");
    expect(missing).toHaveLength(0);
  });

  it("fires css/unreachable-token when file doesn't import token output", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    // No import from a.css to tokens.css

    const source = `.box { color: var(--color-fg); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig({ globalStylesheets: [] }),
    );

    const unreachable = diags.filter((d) => d.code === "css/unreachable-token");
    expect(unreachable.length).toBeGreaterThan(0);
  });

  it("does NOT fire css/unreachable-token for registered tokens", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    // No import — but token is registered

    const source = `.box { color: var(--color-registered); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig({ globalStylesheets: [] }),
    );

    const unreachable = diags.filter((d) => d.code === "css/unreachable-token");
    expect(unreachable).toHaveLength(0);
  });

  it("fires css/primitive-token for primitive tier tokens", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `.box { color: var(--color-raw-blue); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const primitive = diags.filter((d) => d.code === "css/primitive-token");
    expect(primitive.length).toBeGreaterThan(0);
  });

  it("respects suppression comments", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `/* terrazzo-lsp-disable-next-line css/primitive-token */
.box { color: var(--color-raw-blue); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const primitive = diags.filter((d) => d.code === "css/primitive-token");
    expect(primitive).toHaveLength(0);
  });

  it("respects severity=off for disabled diagnostics", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const config = makeConfig();
    config.diagnostics.set("css/primitive-token", null);

    const source = `.box { color: var(--color-raw-blue); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      config,
    );

    const primitive = diags.filter((d) => d.code === "css/primitive-token");
    expect(primitive).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // css/stale-fallback
  // -----------------------------------------------------------------------

  it("fires css/stale-fallback when fallback differs from current value", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    // --spacing-sm is 8px, but fallback says 16px
    const source = `.box { padding: var(--spacing-sm, 16px); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const stale = diags.filter((d) => d.code === "css/stale-fallback");
    expect(stale.length).toBeGreaterThan(0);
    expect(stale[0].message).toContain("16px");
  });

  it("does NOT fire css/stale-fallback when fallback matches current value", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    // --spacing-sm is 8px, fallback is 8px
    const source = `.box { padding: var(--spacing-sm, 8px); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const stale = diags.filter((d) => d.code === "css/stale-fallback");
    expect(stale).toHaveLength(0);
  });

  it("does NOT fire css/stale-fallback for equivalent colour representations", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    // --color-fg.valueLight is "#000", and "black" is equivalent
    const source = `.box { color: var(--color-fg, black); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const stale = diags.filter((d) => d.code === "css/stale-fallback");
    expect(stale).toHaveLength(0);
  });

  it("does NOT fire css/stale-fallback inside calc()", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const source = `.box { width: calc(100% - var(--spacing-sm, 16px)); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const stale = diags.filter((d) => d.code === "css/stale-fallback");
    expect(stale).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // css/scoped-usage
  // -----------------------------------------------------------------------

  it("fires css/scoped-usage for class-scoped declaration used from another file", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    // A .button-scoped declaration in Button.css
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
    graph.addImport("file:///a.css", "file:///Button.css");

    const source = `.box { padding: var(--button-pad); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const scoped = diags.filter((d) => d.code === "css/scoped-usage");
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped[0].message).toContain(".button");
    expect(scoped[0].severity).toBe(DiagnosticSeverity.Warning);
  });

  it("does NOT fire css/scoped-usage in the declaring file", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

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

    const source = `.button { padding: var(--button-pad); }`;
    const diags = produceDiagnostics(
      "file:///Button.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const scoped = diags.filter((d) => d.code === "css/scoped-usage");
    expect(scoped).toHaveLength(0);
  });

  it("does NOT fire css/scoped-usage when a global declaration exists", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    // Both scoped and global declarations
    graph.addDeclaration({
      cssVar: "--shared-var",
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
    graph.addDeclaration({
      cssVar: "--shared-var",
      fileUri: "file:///global.css",
      line: 1,
      column: 2,
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
    graph.addImport("file:///a.css", "file:///Button.css");
    graph.addImport("file:///a.css", "file:///global.css");

    const source = `.box { padding: var(--shared-var); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const scoped = diags.filter((d) => d.code === "css/scoped-usage");
    expect(scoped).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // css/unknown-var (Phase 2)
  // -----------------------------------------------------------------------

  it("fires css/unknown-var when enabled and var is absent from graph", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    const config = makeConfig();
    config.diagnostics.set("css/unknown-var", DiagnosticSeverity.Error);

    const source = `.box { color: var(--does-not-exist); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      config,
    );

    const unknown = diags.filter((d) => d.code === "css/unknown-var");
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown[0].severity).toBe(DiagnosticSeverity.Error);
    expect(unknown[0].message).toContain("--does-not-exist");
  });

  it("does NOT fire css/unknown-var when disabled (default)", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    const source = `.box { color: var(--does-not-exist); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const unknown = diags.filter((d) => d.code === "css/unknown-var");
    expect(unknown).toHaveLength(0);
  });

  it("does NOT fire css/unknown-var when var is known in graph", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    const config = makeConfig();
    config.diagnostics.set("css/unknown-var", DiagnosticSeverity.Error);

    const source = `.box { color: var(--color-fg); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      config,
    );

    const unknown = diags.filter((d) => d.code === "css/unknown-var");
    expect(unknown).toHaveLength(0);
  });

  it("does NOT fire css/unknown-var for locally declared vars", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

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

    const config = makeConfig();
    config.diagnostics.set("css/unknown-var", DiagnosticSeverity.Error);

    const source = `.box { color: var(--local-var); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      config,
    );

    const unknown = diags.filter((d) => d.code === "css/unknown-var");
    expect(unknown).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // css/no-color-scheme (Phase 2)
  // -----------------------------------------------------------------------

  it("fires css/no-color-scheme when light-dark() used without color-scheme", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    const source = `.box { color: light-dark(black, white); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const nocs = diags.filter((d) => d.code === "css/no-color-scheme");
    expect(nocs.length).toBeGreaterThan(0);
    expect(nocs[0].severity).toBe(DiagnosticSeverity.Information);
  });

  it("does NOT fire css/no-color-scheme when color-scheme is present", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    const source = `:root { color-scheme: light dark; }\n.box { color: light-dark(black, white); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const nocs = diags.filter((d) => d.code === "css/no-color-scheme");
    expect(nocs).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // css/type-uncertain (Phase 2)
  // -----------------------------------------------------------------------

  it("fires css/type-uncertain for shorthand property with ambiguous component", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    loadArtifact(ARTIFACT, graph);
    graph.addImport("file:///a.css", "file:///project/dist/tokens.css");

    // 'background' is a shorthand — using a dimension token is ambiguous
    // (could be background-size, background-position)
    const source = `.box { background: var(--spacing-sm); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const uncertain = diags.filter((d) => d.code === "css/type-uncertain");
    expect(uncertain.length).toBeGreaterThan(0);
    expect(uncertain[0].severity).toBe(DiagnosticSeverity.Information);
  });

  it("uses info severity for media-scoped declarations", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();

    graph.addDeclaration({
      cssVar: "--media-var",
      fileUri: "file:///theme.css",
      line: 3,
      column: 4,
      rawValue: "blue",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [{ name: "media", prelude: "(prefers-color-scheme: dark)" }],
        scopeType: "media",
        isGlobal: false,
        isScoped: true,
      },
    });
    graph.addImport("file:///a.css", "file:///theme.css");

    const source = `.box { color: var(--media-var); }`;
    const diags = produceDiagnostics(
      "file:///a.css",
      source,
      graph,
      cache,
      makeConfig(),
    );

    const scoped = diags.filter((d) => d.code === "css/scoped-usage");
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped[0].severity).toBe(DiagnosticSeverity.Information);
  });
});

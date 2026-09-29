/**
 * Artifact-level DTCG diagnostic tests — TDD.
 *
 * Tests dtcg/missing-type and dtcg/draft-syntax diagnostics
 * which operate on loaded artifact tokens rather than CSS files.
 *
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../../graph/index.js";
import { resolveConfig } from "../../protocol/index.js";
import { makeArtifactToken } from "../../testing/index.js";
import type { RawArtifact, TokenNode } from "../../types/index.js";
import produceArtifactDiagnostics from "./index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraph(tokens: TokenNode[]): TokenGraph {
  const graph = new TokenGraph();
  for (const token of tokens) {
    graph.addToken(token);
  }
  return graph;
}

const defaultConfig = resolveConfig({}, "/project");

// ---------------------------------------------------------------------------
// dtcg/missing-type
// ---------------------------------------------------------------------------

describe("dtcg/missing-type", () => {
  it("flags tokens with null type", () => {
    const graph = makeGraph([makeArtifactToken({ cssVar: "--x", type: null })]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results.some((d) => d.code === "dtcg/missing-type")).toBe(true);
  });

  it("does not flag tokens with valid type", () => {
    const graph = makeGraph([
      makeArtifactToken({ cssVar: "--x", type: "color" }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results.some((d) => d.code === "dtcg/missing-type")).toBe(false);
  });

  it("includes token id and cssVar in message", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-primary",
        id: "color.primary",
        type: null,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const diag = results.find((d) => d.code === "dtcg/missing-type");
    expect(diag?.message).toContain("color.primary");
    expect(diag?.message).toContain("--color-primary");
  });

  it("uses sourceFile and sourceLine for range", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--x",
        type: null,
        sourceFile: "/src/tokens/color.tokens.json",
        sourceLine: 12,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const diag = results.find((d) => d.code === "dtcg/missing-type");
    expect(diag?.range.start.line).toBe(12);
  });

  it("respects severity config (off disables)", () => {
    const config = resolveConfig(
      { diagnostics: { inferredType: "off" } },
      "/project",
    );
    const graph = makeGraph([makeArtifactToken({ cssVar: "--x", type: null })]);
    const results = produceArtifactDiagnostics(graph, config);
    expect(results.some((d) => d.code === "dtcg/missing-type")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dtcg/draft-syntax
// ---------------------------------------------------------------------------

describe("dtcg/draft-syntax", () => {
  it("flags tokens with draft extensions marker", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--x",
        extensions: { "com.terrazzo.draft-syntax": true },
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results.some((d) => d.code === "dtcg/draft-syntax")).toBe(true);
  });

  it("does not flag tokens without draft marker", () => {
    const graph = makeGraph([makeArtifactToken({ cssVar: "--x" })]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results.some((d) => d.code === "dtcg/draft-syntax")).toBe(false);
  });

  it("flags tokens with empty id (suggests draft source)", () => {
    const graph = makeGraph([makeArtifactToken({ cssVar: "--x", id: "" })]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results.some((d) => d.code === "dtcg/draft-syntax")).toBe(true);
  });

  it("respects severity config (off disables)", () => {
    const config = resolveConfig(
      { diagnostics: { draftFormat: "off" } },
      "/project",
    );
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--x",
        extensions: { "com.terrazzo.draft-syntax": true },
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, config);
    expect(results.some((d) => d.code === "dtcg/draft-syntax")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dtcg/broken-alias
// ---------------------------------------------------------------------------

describe("dtcg/broken-alias", () => {
  it("flags tokens whose alias chain references non-existent IDs", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-alias",
        id: "color.alias",
        aliasChain: ["--color-primary", "--color-nonexistent"],
        isPrimary: false,
      }),
      makeArtifactToken({
        cssVar: "--color-primary",
        id: "color.primary",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const broken = results.filter((d) => d.code === "dtcg/broken-alias");
    expect(broken.length).toBeGreaterThan(0);
    expect(broken[0].message).toContain("--color-nonexistent");
  });

  it("does not flag tokens with valid alias chains", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-alias",
        id: "color.alias",
        aliasChain: ["--color-primary"],
        isPrimary: false,
      }),
      makeArtifactToken({
        cssVar: "--color-primary",
        id: "color.primary",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const broken = results.filter((d) => d.code === "dtcg/broken-alias");
    expect(broken).toHaveLength(0);
  });

  it("does not flag primary tokens (no alias chain)", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-primary",
        id: "color.primary",
        aliasChain: [],
        isPrimary: true,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const broken = results.filter((d) => d.code === "dtcg/broken-alias");
    expect(broken).toHaveLength(0);
  });

  it("respects severity config (off disables)", () => {
    const config = resolveConfig(
      { diagnostics: { brokenAlias: "off" } },
      "/project",
    );
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-alias",
        id: "color.alias",
        aliasChain: ["--color-nonexistent"],
        isPrimary: false,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, config);
    const broken = results.filter((d) => d.code === "dtcg/broken-alias");
    expect(broken).toHaveLength(0);
  });

  it("does not flag aliased tokens after loadArtifact rewrites the chain to cssVars", () => {
    // Regression: loadArtifact's buildAliasChains overwrites aliasChain with
    // resolved CSS var names, so broken-alias must look up by cssVar. Before
    // the fix this flagged every aliased token in a real artifact.
    const artifact: RawArtifact = {
      version: "1.0.0",
      generator: "test",
      tokens: {
        "--color-base": {
          id: "color.base",
          type: "color",
          tier: "primitive",
          isPaired: false,
          valueLight: "oklch(50% 0.1 200)",
          cssOutputFile: "tokens.css",
        },
        "--color-fg": {
          id: "color.fg",
          type: "color",
          tier: "semantic",
          isPaired: false,
          valueLight: "var(--color-base)",
          cssOutputFile: "tokens.css",
        },
      },
    };
    const graph = new TokenGraph();
    loadArtifact(artifact, graph);

    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results.filter((d) => d.code === "dtcg/broken-alias")).toHaveLength(
      0,
    );
    // Proves the resolution path actually ran (chain is now cssVar-based).
    expect(graph.resolveToken("--color-fg")?.aliasChain).toEqual([
      "--color-base",
    ]);
  });
});

// ---------------------------------------------------------------------------
// dtcg/circular-alias
// ---------------------------------------------------------------------------

describe("dtcg/circular-alias", () => {
  it("flags tokens with duplicate entries in alias chain (cycle)", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-a",
        id: "color.a",
        aliasChain: ["--color-b", "--color-a"],
        isPrimary: false,
      }),
      makeArtifactToken({
        cssVar: "--color-b",
        id: "color.b",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const circular = results.filter((d) => d.code === "dtcg/circular-alias");
    expect(circular.length).toBeGreaterThan(0);
    expect(circular[0].message).toContain("--color-a");
  });

  it("detects self-referencing alias", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-self",
        id: "color.self",
        aliasChain: ["--color-self"],
        isPrimary: false,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const circular = results.filter((d) => d.code === "dtcg/circular-alias");
    expect(circular.length).toBeGreaterThan(0);
  });

  it("does not flag tokens without cycles", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-alias",
        id: "color.alias",
        aliasChain: ["--color-primary"],
        isPrimary: false,
      }),
      makeArtifactToken({
        cssVar: "--color-primary",
        id: "color.primary",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const circular = results.filter((d) => d.code === "dtcg/circular-alias");
    expect(circular).toHaveLength(0);
  });

  it("respects severity config (off disables)", () => {
    const config = resolveConfig(
      { diagnostics: { circularAlias: "off" } },
      "/project",
    );
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--color-a",
        id: "color.a",
        aliasChain: ["--color-b", "--color-a"],
        isPrimary: false,
      }),
      makeArtifactToken({
        cssVar: "--color-b",
        id: "color.b",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, config);
    const circular = results.filter((d) => d.code === "dtcg/circular-alias");
    expect(circular).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// dtcg/schema-violation
// ---------------------------------------------------------------------------

describe("dtcg/schema-violation", () => {
  it("flags tokens with colour type but non-colour value", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--broken-color",
        id: "color.broken",
        type: "color",
        valueLight: "not-a-color-at-all",
        hexLight: null,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const schema = results.filter((d) => d.code === "dtcg/schema-violation");
    expect(schema.length).toBeGreaterThan(0);
    expect(schema[0].message).toContain("color.broken");
  });

  it("does not flag valid colour tokens", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--valid-color",
        id: "color.valid",
        type: "color",
        valueLight: "#ff0000",
        hexLight: "#ff0000",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const schema = results.filter((d) => d.code === "dtcg/schema-violation");
    expect(schema).toHaveLength(0);
  });

  it("flags dimension tokens with non-dimension values", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--broken-dim",
        id: "size.broken",
        type: "dimension",
        cssType: "<unknown>",
        valueLight: "banana",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const schema = results.filter((d) => d.code === "dtcg/schema-violation");
    expect(schema.length).toBeGreaterThan(0);
  });

  it("does not flag dimension tokens with valid values", () => {
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--valid-dim",
        id: "size.valid",
        type: "dimension",
        cssType: "<length>",
        valueLight: "16px",
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    const schema = results.filter((d) => d.code === "dtcg/schema-violation");
    expect(schema).toHaveLength(0);
  });

  it("respects severity config (off disables)", () => {
    const config = resolveConfig(
      { diagnostics: { schemaViolation: "off" } },
      "/project",
    );
    const graph = makeGraph([
      makeArtifactToken({
        cssVar: "--broken-color",
        id: "color.broken",
        type: "color",
        valueLight: "not-a-color",
        hexLight: null,
      }),
    ]);
    const results = produceArtifactDiagnostics(graph, config);
    const schema = results.filter((d) => d.code === "dtcg/schema-violation");
    expect(schema).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Combined
// ---------------------------------------------------------------------------

describe("produceArtifactDiagnostics", () => {
  it("skips non-artifact tokens", () => {
    const graph = new TokenGraph();
    graph.addToken({
      ...makeArtifactToken({ cssVar: "--local", type: null }),
      provenance: { kind: "local", fileUri: "file:///a.css" },
    });
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results).toHaveLength(0);
  });

  it("returns empty array when no issues", () => {
    const graph = makeGraph([
      makeArtifactToken({ cssVar: "--a", type: "color", id: "color.a" }),
      makeArtifactToken({ cssVar: "--b", type: "dimension", id: "size.b" }),
    ]);
    const results = produceArtifactDiagnostics(graph, defaultConfig);
    expect(results).toHaveLength(0);
  });
});

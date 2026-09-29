import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkPrimitiveToken from "./checkPrimitiveToken.js";
import type { UsageRuleContext } from "./types.js";

function makeContext(overrides?: Partial<UsageRuleContext>): UsageRuleContext {
  return {
    usage: {
      cssVar: "--color-palette-red",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      varNameColumn: 16,
      varNameLength: 20,
      property: "color",
      fallback: null,
    },
    token: makeTokenNode({
      cssVar: "--color-palette-red",
      tier: "primitive",
      cssOutputFile: "/project/dist/tokens.css",
    }),
    prop: null,
    isRegistered: false,
    lineText: ".x { color: var(--color-palette-red); }",
    insideMath: false,
    fileUri: "file:///a.css",
    reachableFiles: new Set(),
    globalUris: new Set(),
    config: makeConfig(),
    directives: [],
    graph: new TokenGraph(),
    ...overrides,
  };
}

describe("checkPrimitiveToken", () => {
  it("emits diagnostic for primitive-tier artifact token used outside its output file", () => {
    const results: Diagnostic[] = [];
    checkPrimitiveToken(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/primitive-token");
  });

  it("does NOT emit when no token", () => {
    const results: Diagnostic[] = [];
    checkPrimitiveToken(makeContext({ token: null }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when tier is semantic", () => {
    const results: Diagnostic[] = [];
    checkPrimitiveToken(
      makeContext({
        token: makeTokenNode({
          cssVar: "--color-bg",
          tier: "semantic",
          cssOutputFile: "/project/dist/tokens.css",
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit for non-artifact provenance", () => {
    const results: Diagnostic[] = [];
    checkPrimitiveToken(
      makeContext({
        token: makeTokenNode({
          cssVar: "--color-palette-red",
          tier: "primitive",
          provenance: { kind: "local", fileUri: "file:///a.css" },
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when usage is in the token's own output file", () => {
    const results: Diagnostic[] = [];
    const { href } = new URL("file:///project/dist/tokens.css");
    checkPrimitiveToken(makeContext({ fileUri: href }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkPrimitiveToken(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/primitive-token", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when suppressed", () => {
    const results: Diagnostic[] = [];
    checkPrimitiveToken(
      makeContext({
        directives: [
          { kind: "disable-line", rules: ["css/primitive-token"], line: 0 },
        ],
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

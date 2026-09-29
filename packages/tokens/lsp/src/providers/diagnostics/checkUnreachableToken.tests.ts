import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkUnreachableToken from "./checkUnreachableToken.js";
import type { UsageRuleContext } from "./types.js";

function makeContext(overrides?: Partial<UsageRuleContext>): UsageRuleContext {
  return {
    usage: {
      cssVar: "--color-bg",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      varNameColumn: 16,
      varNameLength: 10,
      property: "color",
      fallback: null,
    },
    token: makeTokenNode({
      cssVar: "--color-bg",
      cssOutputFile: "/project/dist/tokens.css",
    }),
    prop: null,
    isRegistered: false,
    lineText: ".x { color: var(--color-bg); }",
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

describe("checkUnreachableToken", () => {
  it("emits diagnostic when token CSS output is not reachable", () => {
    const results: Diagnostic[] = [];
    checkUnreachableToken(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/unreachable-token");
  });

  it("does NOT emit when no token", () => {
    const results: Diagnostic[] = [];
    checkUnreachableToken(makeContext({ token: null }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when token is not an artifact", () => {
    const results: Diagnostic[] = [];
    checkUnreachableToken(
      makeContext({
        token: makeTokenNode({
          cssVar: "--color-bg",
          provenance: { kind: "local", fileUri: "file:///a.css" },
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when token is registered", () => {
    const results: Diagnostic[] = [];
    checkUnreachableToken(
      makeContext({
        token: makeTokenNode({
          cssVar: "--color-bg",
          registered: true,
          cssOutputFile: "/project/dist/tokens.css",
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when output file is in reachable set", () => {
    const { href } = new URL("file:///project/dist/tokens.css");
    const results: Diagnostic[] = [];
    checkUnreachableToken(
      makeContext({ reachableFiles: new Set([href]) }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when output file is a global stylesheet", () => {
    const { href } = new URL("file:///project/dist/tokens.css");
    const results: Diagnostic[] = [];
    checkUnreachableToken(
      makeContext({ globalUris: new Set([href]) }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkUnreachableToken(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/unreachable-token", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

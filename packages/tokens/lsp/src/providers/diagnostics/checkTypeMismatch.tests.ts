import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkTypeMismatch from "./checkTypeMismatch.js";
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
      property: "width",
      fallback: null,
    },
    token: makeTokenNode({
      cssVar: "--color-bg",
      cssType: "<color>",
    }),
    prop: null,
    isRegistered: false,
    lineText: ".x { width: var(--color-bg); }",
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

describe("checkTypeMismatch", () => {
  it("emits diagnostic when token type doesn't match property", () => {
    const results: Diagnostic[] = [];
    checkTypeMismatch(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/type-mismatch");
  });

  it("does NOT emit when types are compatible", () => {
    const results: Diagnostic[] = [];
    checkTypeMismatch(
      makeContext({
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
        lineText: ".x { color: var(--color-bg); }",
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when token type is unknown", () => {
    const results: Diagnostic[] = [];
    checkTypeMismatch(
      makeContext({
        token: makeTokenNode({
          cssVar: "--color-bg",
          cssType: "<unknown>",
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when no token", () => {
    const results: Diagnostic[] = [];
    checkTypeMismatch(makeContext({ token: null }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when inside calc()", () => {
    const results: Diagnostic[] = [];
    checkTypeMismatch(makeContext({ insideMath: true }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkTypeMismatch(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/type-mismatch", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

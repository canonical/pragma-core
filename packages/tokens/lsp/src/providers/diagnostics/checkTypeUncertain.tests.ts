import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkTypeUncertain from "./checkTypeUncertain.js";
import type { UsageRuleContext } from "./types.js";

function makeContext(overrides?: Partial<UsageRuleContext>): UsageRuleContext {
  return {
    usage: {
      cssVar: "--color-bg",
      fileUri: "file:///a.css",
      line: 0,
      column: 0,
      varNameColumn: 20,
      varNameLength: 10,
      property: "background",
      fallback: null,
    },
    token: makeTokenNode({
      cssVar: "--color-bg",
      cssType: "<color>",
    }),
    prop: null,
    isRegistered: false,
    lineText: ".x { background: var(--color-bg); }",
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

describe("checkTypeUncertain", () => {
  it("emits diagnostic when token is used in a shorthand property", () => {
    const results: Diagnostic[] = [];
    checkTypeUncertain(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/type-uncertain");
  });

  it("does NOT emit when property is not a shorthand", () => {
    const results: Diagnostic[] = [];
    checkTypeUncertain(
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
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when token type is unknown", () => {
    const results: Diagnostic[] = [];
    checkTypeUncertain(
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

  it("does NOT emit when inside calc()", () => {
    const results: Diagnostic[] = [];
    checkTypeUncertain(makeContext({ insideMath: true }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkTypeUncertain(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/type-uncertain", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

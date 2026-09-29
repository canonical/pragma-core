import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkMissingFallback from "./checkMissingFallback.js";
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
    token: null,
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

describe("checkMissingFallback", () => {
  it("emits diagnostic when var() has no fallback, is not registered, and not artifact", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/missing-fallback");
  });

  it("does NOT emit when fallback is present", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(
      makeContext({
        usage: {
          cssVar: "--color-bg",
          fileUri: "file:///a.css",
          line: 0,
          column: 0,
          varNameColumn: 16,
          varNameLength: 10,
          property: "color",
          fallback: "red",
        },
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when property is registered", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(makeContext({ isRegistered: true }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when token has artifact provenance", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(
      makeContext({
        token: makeTokenNode({ cssVar: "--color-bg" }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when inside calc()", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(makeContext({ insideMath: true }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/missing-fallback", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when line is suppressed", () => {
    const results: Diagnostic[] = [];
    checkMissingFallback(
      makeContext({
        directives: [
          { kind: "disable-line", rules: ["css/missing-fallback"], line: 0 },
        ],
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

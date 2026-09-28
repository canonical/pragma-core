import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkStaleFallback from "./checkStaleFallback.js";
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
      fallback: "#000",
    },
    token: makeTokenNode({
      cssVar: "--color-bg",
      type: "color",
      valueLight: "#fff",
    }),
    prop: null,
    isRegistered: false,
    lineText: ".x { color: var(--color-bg, #000); }",
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

describe("checkStaleFallback", () => {
  it("emits diagnostic when fallback does not match current value", () => {
    const results: Diagnostic[] = [];
    checkStaleFallback(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/stale-fallback");
  });

  it("does NOT emit when no fallback", () => {
    const results: Diagnostic[] = [];
    checkStaleFallback(
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

  it("does NOT emit when no token", () => {
    const results: Diagnostic[] = [];
    checkStaleFallback(makeContext({ token: null }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when inside calc()", () => {
    const results: Diagnostic[] = [];
    checkStaleFallback(makeContext({ insideMath: true }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when fallback matches current value", () => {
    const results: Diagnostic[] = [];
    checkStaleFallback(
      makeContext({
        usage: {
          cssVar: "--color-bg",
          fileUri: "file:///a.css",
          line: 0,
          column: 0,
          varNameColumn: 16,
          varNameLength: 10,
          property: "color",
          fallback: "#fff",
        },
        token: makeTokenNode({
          cssVar: "--color-bg",
          type: "color",
          valueLight: "#fff",
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkStaleFallback(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/stale-fallback", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

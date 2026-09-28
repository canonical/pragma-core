import { describe, expect, it } from "vitest";
import { makeConfig } from "../../testing/index.js";
import type { Diagnostic } from "../../types/index.js";
import checkNoColorScheme from "./checkNoColorScheme.js";
import type { FileRuleContext } from "./types.js";

function makeContext(overrides?: Partial<FileRuleContext>): FileRuleContext {
  return {
    source: ".x { background: light-dark(#fff, #000); }",
    config: makeConfig(),
    directives: [],
    ...overrides,
  };
}

describe("checkNoColorScheme", () => {
  it("emits diagnostic when light-dark() is used without color-scheme", () => {
    const results: Diagnostic[] = [];
    checkNoColorScheme(makeContext(), results);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("css/no-color-scheme");
  });

  it("does NOT emit when no light-dark() in source", () => {
    const results: Diagnostic[] = [];
    checkNoColorScheme(makeContext({ source: ".x { color: red; }" }), results);
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when color-scheme is declared", () => {
    const results: Diagnostic[] = [];
    checkNoColorScheme(
      makeContext({
        source: `:root { color-scheme: light dark; }\n.x { background: light-dark(#fff, #000); }`,
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when severity is off", () => {
    const results: Diagnostic[] = [];
    checkNoColorScheme(
      makeContext({
        config: makeConfig({
          diagnostics: new Map([
            ...makeConfig().diagnostics,
            ["css/no-color-scheme", undefined as never],
          ]),
        }),
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });

  it("does NOT emit when line is suppressed", () => {
    const results: Diagnostic[] = [];
    checkNoColorScheme(
      makeContext({
        directives: [
          { kind: "disable-line", rules: ["css/no-color-scheme"], line: 0 },
        ],
      }),
      results,
    );
    expect(results).toHaveLength(0);
  });
});

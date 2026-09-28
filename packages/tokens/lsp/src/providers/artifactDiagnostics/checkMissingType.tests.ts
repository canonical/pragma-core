import { describe, expect, it } from "vitest";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic, TokenNode } from "../../types/index.js";
import { DiagnosticSeverity } from "../../types/index.js";
import checkMissingType from "./checkMissingType.js";

function run(
  overrides?: Partial<TokenNode>,
  severityOff = false,
): Diagnostic[] {
  const results: Diagnostic[] = [];
  const token = makeTokenNode({ cssVar: "--t", type: null, ...overrides });
  const config = severityOff
    ? makeConfig({ diagnostics: new Map([["dtcg/missing-type", null]]) })
    : makeConfig({
        diagnostics: new Map([
          ["dtcg/missing-type", DiagnosticSeverity.Warning],
        ]),
      });
  checkMissingType(token, config, results);
  return results;
}

describe("checkMissingType", () => {
  it("emits diagnostic when token has no type", () => {
    const results = run({ type: null });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/missing-type");
  });

  it("does not emit when token has a type", () => {
    expect(run({ type: "color" })).toHaveLength(0);
  });

  it("does not emit when severity is off", () => {
    expect(run({ type: null }, true)).toHaveLength(0);
  });
});

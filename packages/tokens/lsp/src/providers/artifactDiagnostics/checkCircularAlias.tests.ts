import { describe, expect, it } from "vitest";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic, TokenNode } from "../../types/index.js";
import { DiagnosticSeverity } from "../../types/index.js";
import checkCircularAlias from "./checkCircularAlias.js";

function run(
  overrides?: Partial<TokenNode>,
  severityOff = false,
): Diagnostic[] {
  const results: Diagnostic[] = [];
  const token = makeTokenNode({ cssVar: "--t", ...overrides });
  const config = severityOff
    ? makeConfig({ diagnostics: new Map([["dtcg/circular-alias", null]]) })
    : makeConfig({
        diagnostics: new Map([
          ["dtcg/circular-alias", DiagnosticSeverity.Warning],
        ]),
      });
  checkCircularAlias(token, config, results);
  return results;
}

describe("checkCircularAlias", () => {
  it("emits diagnostic when token's own cssVar appears in alias chain", () => {
    const results = run({
      cssVar: "--color-primary",
      aliasChain: ["--color-base", "--color-primary"],
    });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/circular-alias");
    expect(results[0].message).toContain("Circular");
  });

  it("emits diagnostic when duplicate ID appears in alias chain", () => {
    const results = run({ id: "a", aliasChain: ["b", "c", "b"] });
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("b");
  });

  it("does not emit when alias chain has no cycles", () => {
    expect(run({ id: "a", aliasChain: ["b", "c"] })).toHaveLength(0);
  });

  it("does not emit when alias chain is empty", () => {
    expect(run({ aliasChain: [] })).toHaveLength(0);
  });

  it("does not emit when severity is off", () => {
    expect(run({ id: "a", aliasChain: ["a"] }, true)).toHaveLength(0);
  });
});

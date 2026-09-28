import { describe, expect, it } from "vitest";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic, TokenNode } from "../../types/index.js";
import { DiagnosticSeverity } from "../../types/index.js";
import checkBrokenAlias from "./checkBrokenAlias.js";

function run(
  overrides?: Partial<TokenNode>,
  tokenById?: Map<string, TokenNode>,
  severityOff = false,
): Diagnostic[] {
  const results: Diagnostic[] = [];
  const token = makeTokenNode({ cssVar: "--t", ...overrides });
  const config = severityOff
    ? makeConfig({ diagnostics: new Map([["dtcg/broken-alias", null]]) })
    : makeConfig({
        diagnostics: new Map([
          ["dtcg/broken-alias", DiagnosticSeverity.Warning],
        ]),
      });
  checkBrokenAlias(token, tokenById ?? new Map(), config, results);
  return results;
}

describe("checkBrokenAlias", () => {
  it("emits diagnostic when alias target does not exist", () => {
    const results = run({ aliasChain: ["missing.token"] });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/broken-alias");
    expect(results[0].message).toContain("missing.token");
  });

  it("does not emit when alias chain is empty", () => {
    expect(run({ aliasChain: [] })).toHaveLength(0);
  });

  it("does not emit when all aliases exist", () => {
    const existing = makeTokenNode({ cssVar: "--ref" });
    const byCssVar = new Map([["--ref", existing]]);
    expect(run({ aliasChain: ["--ref"] }, byCssVar)).toHaveLength(0);
  });

  it("reports only the first broken alias", () => {
    const results = run({ aliasChain: ["missing1", "missing2"] });
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("missing1");
  });

  it("does not emit when severity is off", () => {
    expect(run({ aliasChain: ["missing"] }, undefined, true)).toHaveLength(0);
  });
});

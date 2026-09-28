import { describe, expect, it } from "vitest";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic, TokenNode } from "../../types/index.js";
import { DiagnosticSeverity } from "../../types/index.js";
import checkDraftSyntax from "./checkDraftSyntax.js";

function run(
  overrides?: Partial<TokenNode>,
  severityOff = false,
): Diagnostic[] {
  const results: Diagnostic[] = [];
  const token = makeTokenNode({ cssVar: "--t", ...overrides });
  const config = severityOff
    ? makeConfig({ diagnostics: new Map([["dtcg/draft-syntax", null]]) })
    : makeConfig({
        diagnostics: new Map([
          ["dtcg/draft-syntax", DiagnosticSeverity.Warning],
        ]),
      });
  checkDraftSyntax(token, config, results);
  return results;
}

describe("checkDraftSyntax", () => {
  it("emits diagnostic when draft marker extension is set", () => {
    const results = run({ extensions: { "com.terrazzo.draft-syntax": true } });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/draft-syntax");
    expect(results[0].message).toContain("draft field syntax");
  });

  it("emits diagnostic when token ID is empty", () => {
    const results = run({ id: "" });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/draft-syntax");
    expect(results[0].message).toContain("empty token ID");
  });

  it("does not emit when no draft marker and ID is non-empty", () => {
    expect(run({ id: "color.primary", extensions: {} })).toHaveLength(0);
  });

  it("does not emit when severity is off", () => {
    expect(
      run({ extensions: { "com.terrazzo.draft-syntax": true } }, true),
    ).toHaveLength(0);
  });
});

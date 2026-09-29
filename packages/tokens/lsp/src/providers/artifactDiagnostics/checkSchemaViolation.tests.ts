import { describe, expect, it } from "vitest";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import type { Diagnostic, TokenNode } from "../../types/index.js";
import { DiagnosticSeverity } from "../../types/index.js";
import checkSchemaViolation from "./checkSchemaViolation.js";

function run(
  overrides?: Partial<TokenNode>,
  severityOff = false,
): Diagnostic[] {
  const results: Diagnostic[] = [];
  const token = makeTokenNode({ cssVar: "--t", ...overrides });
  const config = severityOff
    ? makeConfig({ diagnostics: new Map([["dtcg/schema-violation", null]]) })
    : makeConfig({
        diagnostics: new Map([
          ["dtcg/schema-violation", DiagnosticSeverity.Warning],
        ]),
      });
  checkSchemaViolation(token, config, results);
  return results;
}

describe("checkSchemaViolation", () => {
  it("emits diagnostic for color type with unparseable value", () => {
    const results = run({
      type: "color",
      valueLight: "not-a-color",
      hexLight: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/schema-violation");
    expect(results[0].message).toContain("not a valid CSS colour");
  });

  it("does not emit for color type with valid hex", () => {
    expect(
      run({ type: "color", valueLight: "#fff", hexLight: "#ffffff" }),
    ).toHaveLength(0);
  });

  it("emits diagnostic for dimension type with unknown CSS type", () => {
    const results = run({
      type: "dimension",
      cssType: "<unknown>",
      valueLight: "abc",
    });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("dtcg/schema-violation");
    expect(results[0].message).toContain("not a valid dimension");
  });

  it("does not emit for dimension type with resolved CSS type", () => {
    expect(run({ type: "dimension", cssType: "<length>" })).toHaveLength(0);
  });

  it("does not emit for non-color non-dimension types", () => {
    expect(run({ type: "number" })).toHaveLength(0);
  });

  it("does not emit when severity is off", () => {
    expect(
      run({ type: "color", valueLight: "bad", hexLight: null }, true),
    ).toHaveLength(0);
  });
});

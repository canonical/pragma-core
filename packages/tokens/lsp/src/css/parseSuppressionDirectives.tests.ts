import { describe, expect, it } from "vitest";
import parseSuppressionDirectives from "./scanners/parseSuppressionDirectives.js";

describe("parseSuppressionDirectives", () => {
  it("parses a disable-all directive", () => {
    const source = "/* terrazzo-lsp-disable */";
    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(1);
    expect(directives[0]).toEqual({
      kind: "disable",
      rules: "all",
      line: 0,
    });
  });

  it("parses a disable with specific rules", () => {
    const source =
      "/* terrazzo-lsp-disable css/primitive-token, css/missing-fallback */";
    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(1);
    expect(directives[0]).toEqual({
      kind: "disable",
      rules: ["css/primitive-token", "css/missing-fallback"],
      line: 0,
    });
  });

  it("parses enable directives", () => {
    const source = "/* terrazzo-lsp-enable css/primitive-token */";
    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(1);
    expect(directives[0]).toEqual({
      kind: "enable",
      rules: ["css/primitive-token"],
      line: 0,
    });
  });

  it("parses disable-next-line", () => {
    const source = "/* terrazzo-lsp-disable-next-line css/stale-fallback */";
    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(1);
    expect(directives[0].kind).toBe("disable-next-line");
  });

  it("parses disable-line", () => {
    const source = "color: var(--x); /* terrazzo-lsp-disable-line */";
    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(1);
    expect(directives[0].kind).toBe("disable-line");
    expect(directives[0].rules).toBe("all");
  });

  it("tracks line numbers correctly", () => {
    const source = [
      "/* line 0 */",
      "/* terrazzo-lsp-disable css/type-mismatch */",
      ".foo { color: red; }",
      "/* terrazzo-lsp-enable css/type-mismatch */",
    ].join("\n");

    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(2);
    expect(directives[0].line).toBe(1);
    expect(directives[1].line).toBe(3);
  });

  it("reports unknown rule names", () => {
    const source = "/* terrazzo-lsp-disable foo/bar, css/type-mismatch */";
    const { directives, unknownRules } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(1);
    expect(unknownRules).toHaveLength(1);
    expect(unknownRules[0]).toEqual({ rule: "foo/bar", line: 0 });
  });

  it("handles enable-all", () => {
    const source = "/* terrazzo-lsp-enable */";
    const { directives } = parseSuppressionDirectives(source);
    expect(directives[0]).toEqual({ kind: "enable", rules: "all", line: 0 });
  });

  it("parses multiple directives on different lines", () => {
    const source = [
      "/* terrazzo-lsp-disable */",
      ".foo { color: red; }",
      "/* terrazzo-lsp-enable */",
    ].join("\n");

    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toHaveLength(2);
    expect(directives[0].kind).toBe("disable");
    expect(directives[1].kind).toBe("enable");
  });

  it("ignores directive-like text inside string literals", () => {
    const source =
      '.foo::before { content: "/* terrazzo-lsp-disable css/type-mismatch */"; }';
    const { directives } = parseSuppressionDirectives(source);
    expect(directives).toEqual([]);
  });
});

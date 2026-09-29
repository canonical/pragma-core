import { describe, expect, it } from "vitest";
import { createDeclaration, createRule, printRules } from "../css-ast/index.js";
import wrapInLayer from "./wrapInLayer.js";

describe("wrapInLayer", () => {
  it("wraps children in an @layer rule", () => {
    const children = [createDeclaration("--x", "1")];
    const result = wrapInLayer("ds.tokens", children);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "Rule",
      prelude: ["@layer ds.tokens"],
    });
    const layerRule = result[0] as { children: unknown[] };
    expect(layerRule.children).toEqual(children);
  });

  it("returns children unwrapped when layerName is null", () => {
    const children = [
      createDeclaration("--x", "1"),
      createDeclaration("--y", "2"),
    ];
    const result = wrapInLayer(null, children);

    expect(result).toEqual(children);
  });

  it("wraps a nested rule structure", () => {
    const children = [createRule([":root"], [createDeclaration("--a", "1")])];
    const result = wrapInLayer("ds.modifiers", children);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "Rule",
      prelude: ["@layer ds.modifiers"],
    });
  });

  it("produces valid CSS when printed", () => {
    const children = [createRule([":root"], [createDeclaration("--x", "1")])];
    const wrapped = wrapInLayer("ds.tokens", children);
    const css = printRules(wrapped);

    expect(css).toContain("@layer ds.tokens");
    expect(css).toContain("--x: 1;");
  });
});

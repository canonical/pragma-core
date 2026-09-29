import { describe, expect, it } from "vitest";
import { parseCSS } from "../lezer/index.js";
import extractDeclarationValue from "./declarations.js";

describe("extractDeclarationValue", () => {
  it("extracts the value after the colon in a declaration", () => {
    const source = ":root { --x: red; }";
    const tree = parseCSS(source);
    const decl = tree.topNode
      .getChild("RuleSet")
      ?.getChild("Block")
      ?.getChild("Declaration");
    expect(decl).toBeTruthy();
    if (!decl) {
      throw new Error("Expected a declaration node");
    }
    const value = extractDeclarationValue(source, decl);
    expect(value).toBe("red");
  });

  it("handles values with multiple tokens", () => {
    const source = ":root { margin: 10px 20px; }";
    const tree = parseCSS(source);
    const decl = tree.topNode
      .getChild("RuleSet")
      ?.getChild("Block")
      ?.getChild("Declaration");
    expect(decl).toBeTruthy();
    if (!decl) {
      throw new Error("Expected a declaration node");
    }
    const value = extractDeclarationValue(source, decl);
    expect(value).toBe("10px 20px");
  });
});

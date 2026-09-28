import { describe, expect, it } from "vitest";
import { parseCSS } from "../lezer/index.js";
import { findAncestor, resolveAncestorSelector } from "./ancestors.js";

describe("findAncestor", () => {
  it("finds a parent node by name", () => {
    const source = ":root { --x: 1; }";
    const tree = parseCSS(source);
    const decl = tree.topNode
      .getChild("RuleSet")
      ?.getChild("Block")
      ?.getChild("Declaration");
    expect(decl).toBeTruthy();
    if (!decl) {
      throw new Error("Expected a declaration node");
    }
    const ruleSet = findAncestor(decl, "RuleSet");
    expect(ruleSet).not.toBeNull();
    if (!ruleSet) {
      throw new Error("Expected a RuleSet ancestor");
    }
    expect(ruleSet.name).toBe("RuleSet");
  });

  it("returns null when no ancestor matches", () => {
    const source = ":root { --x: 1; }";
    const tree = parseCSS(source);
    const decl = tree.topNode
      .getChild("RuleSet")
      ?.getChild("Block")
      ?.getChild("Declaration");
    expect(decl).toBeTruthy();
    if (!decl) {
      throw new Error("Expected a declaration node");
    }
    expect(findAncestor(decl, "MediaStatement")).toBeNull();
  });
});

describe("resolveAncestorSelector", () => {
  it("returns the selector for a RuleSet", () => {
    const source = ".foo { --x: 1; }";
    const tree = parseCSS(source);
    const decl = tree.topNode
      .getChild("RuleSet")
      ?.getChild("Block")
      ?.getChild("Declaration");
    expect(decl).toBeTruthy();
    if (!decl) {
      throw new Error("Expected a declaration node");
    }
    const selector = resolveAncestorSelector(decl, source);
    expect(selector).toBe(".foo");
  });

  it("returns ':root' for a top-level declaration (no RuleSet parent)", () => {
    // Lezer CSS parser wraps top-level bare declarations differently.
    // Use resolveAncestorSelector on a node that genuinely has no RuleSet ancestor.
    const source = ":root { --x: 1; }";
    const tree = parseCSS(source);
    // The RuleSet itself has no RuleSet ancestor
    const ruleSet = tree.topNode.getChild("RuleSet");
    expect(ruleSet).toBeTruthy();
    if (!ruleSet) {
      throw new Error("Expected a RuleSet node");
    }
    const selector = resolveAncestorSelector(ruleSet, source);
    expect(selector).toBe(":root");
  });
});

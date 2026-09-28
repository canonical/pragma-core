import { describe, expect, it } from "vitest";
import parseCSS from "./parseCSS.js";

describe("parseCSS", () => {
  it("returns a Tree with a StyleSheet root", () => {
    const tree = parseCSS(":root { --x: 1; }");
    expect(tree.topNode.name).toBe("StyleSheet");
  });

  it("parses CSS declarations", () => {
    const tree = parseCSS(":root { --a: red; --b: blue; }");
    const block = tree.topNode.getChild("RuleSet")?.getChild("Block");
    expect(block).toBeTruthy();
    if (!block) {
      throw new Error("Expected a block node");
    }
    const decls = block.getChildren("Declaration");
    expect(decls.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts tree fragments for incremental parsing", async () => {
    const source = ":root { --x: 1; }";
    const tree1 = parseCSS(source);
    // Passing fragments from a previous parse should not throw
    const { TreeFragment } = await import("@lezer/common");
    const fragments = TreeFragment.addTree(tree1);
    const tree2 = parseCSS(source, fragments);
    expect(tree2.topNode.name).toBe("StyleSheet");
  });
});

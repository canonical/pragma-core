import { describe, expect, it } from "vitest";
import createTreeFragments from "./createTreeFragments.js";
import parseCSS from "./parseCSS.js";

describe("createTreeFragments", () => {
  it("returns an array of TreeFragment instances", () => {
    const tree = parseCSS(":root { --x: 1; }");
    const fragments = createTreeFragments(tree);
    expect(Array.isArray(fragments)).toBe(true);
    expect(fragments.length).toBeGreaterThan(0);
  });

  it("fragments can be used for incremental parsing", () => {
    const tree = parseCSS(":root { --x: 1; }");
    const fragments = createTreeFragments(tree);
    // Should not throw when used in parseCSS
    const tree2 = parseCSS(":root { --x: 2; }", fragments);
    expect(tree2.topNode.name).toBe("StyleSheet");
  });
});

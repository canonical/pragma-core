import { describe, expect, it } from "vitest";
import applyTreeChanges from "./applyTreeChanges.js";
import computeChangedRange from "./computeChangedRange.js";
import parseCSS from "./parseCSS.js";

describe("applyTreeChanges", () => {
  it("produces fragments that reflect the changes", () => {
    const source1 = ":root { --x: 1; }";
    const source2 = ":root { --x: 2; }";
    const tree = parseCSS(source1);
    const change = computeChangedRange(source1, source2);
    expect(change).not.toBeNull();
    if (!change) {
      throw new Error("Expected a changed range");
    }

    const fragments = applyTreeChanges(tree, [change]);
    expect(Array.isArray(fragments)).toBe(true);
    expect(fragments.length).toBeGreaterThan(0);
  });

  it("fragments enable incremental re-parse", () => {
    const source1 = ":root { --a: red; --b: blue; }";
    const source2 = ":root { --a: green; --b: blue; }";
    const tree1 = parseCSS(source1);
    const change = computeChangedRange(source1, source2);
    expect(change).not.toBeNull();
    if (!change) {
      throw new Error("Expected a changed range");
    }

    const fragments = applyTreeChanges(tree1, [change]);
    const tree2 = parseCSS(source2, fragments);
    expect(tree2.topNode.name).toBe("StyleSheet");
  });
});

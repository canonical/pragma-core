import { describe, expect, it } from "vitest";
import findLineageNode from "./lineage.js";

interface FakeNode {
  name: string;
  parent: FakeNode | null;
}

function chain(...names: string[]): FakeNode {
  let node: FakeNode | null = null;
  for (const name of names) {
    node = { name, parent: node };
  }
  if (!node) {
    throw new Error("Expected at least one node name");
  }
  return node;
}

describe("findLineageNode", () => {
  it("returns the node itself when it matches", () => {
    const node = chain("A");
    expect(findLineageNode(node, "A")).toBe(node);
  });

  it("walks up to find an ancestor by name", () => {
    // chain: C → B → A (C is deepest)
    const a = chain("A", "B", "C");
    const found = findLineageNode(a, "A");
    expect(found).not.toBeNull();
    if (!found) {
      throw new Error("Expected to find ancestor A");
    }
    expect(found.name).toBe("A");
  });

  it("returns null when no match in lineage", () => {
    const node = chain("A", "B");
    expect(findLineageNode(node, "X")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(findLineageNode(null, "A")).toBeNull();
  });
});

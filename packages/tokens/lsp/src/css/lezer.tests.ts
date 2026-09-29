import { describe, expect, it } from "vitest";
import * as lezer from "./lezer/index.js";

describe("parseCSS", () => {
  it("parses representative CSS node types", () => {
    const source = `:root { --color-bg: #fff; color: var(--color-fg); }`;
    const tree = lezer.parseCSS(source);

    expect(tree.topNode.name).toBe("StyleSheet");
    expect(tree.topNode.getChild("RuleSet")).not.toBeNull();
    expect(tree.topNode.getChild("RuleSet")?.getChild("Block")).not.toBeNull();
    expect(
      tree.topNode
        .getChild("RuleSet")
        ?.getChild("Block")
        ?.getChild("Declaration"),
    ).not.toBeNull();
  });

  it("reuses unchanged subtree structure after an incremental edit", () => {
    const previous = `:root { --a: 1; }\n.button { color: var(--a); }`;
    const next = `:root { --a: 2; }\n.button { color: var(--a); }`;
    const previousTree = lezer.parseCSS(previous);
    const change = lezer.computeChangedRange(previous, next);

    expect(change).not.toBeNull();
    if (!change) throw new Error("Expected an incremental change range");
    const nextTree = lezer.parseCSS(
      next,
      lezer.applyTreeChanges(previousTree, [change]),
    );

    const previousRules = previousTree.topNode.getChildren("RuleSet");
    const nextRules = nextTree.topNode.getChildren("RuleSet");

    expect(previousRules).toHaveLength(2);
    expect(nextRules).toHaveLength(2);
    expect(previousRules[1]?.tree).toBe(nextRules[1]?.tree);
  });

  it("keeps an incremental reparse faster than a full parse for a large stylesheet", () => {
    const source = Array.from(
      { length: 1000 },
      (_, index) =>
        `.c${index} { --x-${index}: ${index}px; color: var(--x-${index}); }`,
    ).join("\n");
    const next = source.replace("--x-500: 500px", "--x-500: 501px");
    const previousTree = lezer.parseCSS(source);
    const change = lezer.computeChangedRange(source, next);

    expect(change).not.toBeNull();
    if (!change) throw new Error("Expected an incremental change range");

    const reusedTree = lezer.applyTreeChanges(previousTree, [change]);

    lezer.parseCSS(next, reusedTree);
    lezer.parseCSS(next);

    const incrementalSamples = Array.from({ length: 7 }, () => {
      const start = performance.now();
      lezer.parseCSS(next, reusedTree);
      return performance.now() - start;
    }).sort((left, right) => left - right);
    const fullSamples = Array.from({ length: 7 }, () => {
      const start = performance.now();
      lezer.parseCSS(next);
      return performance.now() - start;
    }).sort((left, right) => left - right);
    const incrementalMedian =
      incrementalSamples[Math.floor(incrementalSamples.length / 2)] ??
      Number.POSITIVE_INFINITY;
    const fullMedian =
      fullSamples[Math.floor(fullSamples.length / 2)] ??
      Number.POSITIVE_INFINITY;

    expect(incrementalMedian).toBeLessThan(fullMedian);
  });
});

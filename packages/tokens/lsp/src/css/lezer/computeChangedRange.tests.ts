import { describe, expect, it } from "vitest";
import computeChangedRange from "./computeChangedRange.js";

describe("computeChangedRange", () => {
  it("returns null when strings are identical", () => {
    expect(computeChangedRange("abc", "abc")).toBeNull();
  });

  it("detects single character change in the middle", () => {
    const result = computeChangedRange("abc", "axc");
    expect(result).toEqual({ fromA: 1, toA: 2, fromB: 1, toB: 2 });
  });

  it("detects insertion at the end", () => {
    const result = computeChangedRange("ab", "abc");
    expect(result).toEqual({ fromA: 2, toA: 2, fromB: 2, toB: 3 });
  });

  it("detects deletion at the end", () => {
    const result = computeChangedRange("abc", "ab");
    expect(result).toEqual({ fromA: 2, toA: 3, fromB: 2, toB: 2 });
  });

  it("detects replacement of different lengths", () => {
    const result = computeChangedRange("abcde", "abXXXde");
    expect(result).toEqual({ fromA: 2, toA: 3, fromB: 2, toB: 5 });
  });

  it("handles completely different strings", () => {
    const result = computeChangedRange("abc", "xyz");
    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected a changed range");
    }
    expect(result.fromA).toBe(0);
  });
});

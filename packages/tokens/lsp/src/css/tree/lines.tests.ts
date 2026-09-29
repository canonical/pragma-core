import { describe, expect, it } from "vitest";
import { buildLineOffsets, getColumnAt, getLineAt } from "./lines.js";

describe("buildLineOffsets", () => {
  it("returns [0] for empty string", () => {
    expect(buildLineOffsets("")).toEqual([0]);
  });

  it("returns [0] for single-line string", () => {
    expect(buildLineOffsets("hello")).toEqual([0]);
  });

  it("returns offsets for each line start", () => {
    // "ab\ncd\ne"
    expect(buildLineOffsets("ab\ncd\ne")).toEqual([0, 3, 6]);
  });

  it("handles trailing newline", () => {
    expect(buildLineOffsets("a\n")).toEqual([0, 2]);
  });
});

describe("getLineAt", () => {
  const offsets = buildLineOffsets("ab\ncd\nefg");
  // offsets: [0, 3, 6]

  it("returns 0 for offset in the first line", () => {
    expect(getLineAt(0, offsets)).toBe(0);
    expect(getLineAt(1, offsets)).toBe(0);
  });

  it("returns 1 for offset in the second line", () => {
    expect(getLineAt(3, offsets)).toBe(1);
    expect(getLineAt(4, offsets)).toBe(1);
  });

  it("returns last line for offset at end", () => {
    expect(getLineAt(8, offsets)).toBe(2);
  });
});

describe("getColumnAt", () => {
  const offsets = buildLineOffsets("ab\ncd\nefg");

  it("returns column within the line", () => {
    expect(getColumnAt(0, offsets)).toBe(0);
    expect(getColumnAt(1, offsets)).toBe(1);
    expect(getColumnAt(3, offsets)).toBe(0); // start of line 1
    expect(getColumnAt(4, offsets)).toBe(1); // 'd' on line 1
    expect(getColumnAt(7, offsets)).toBe(1); // 'f' on line 2
  });
});

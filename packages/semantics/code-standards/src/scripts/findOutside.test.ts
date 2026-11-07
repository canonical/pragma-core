import { describe, expect, it } from "vitest";
import findOutside from "./findOutside.js";

describe("findOutside", () => {
  it("finds a match outside literals", () => {
    expect(findOutside('"key" key', /key/)).toEqual({
      index: 6,
      end: 9,
      text: "key",
    });
  });

  it("skips matches inside comments and IRIs", () => {
    expect(findOutside("# key's\n<http://x/key> key", /key/)?.index).toBe(23);
  });

  it("stops at an unclosed comment or IRI", () => {
    expect(findOutside("# key", /key/)).toBeNull();
    expect(findOutside("<key", /key/)).toBeNull();
  });

  it("starts from the index it is given", () => {
    expect(findOutside("key key", /key/, 1)?.index).toBe(4);
  });

  it("keeps the pattern's flags and leaves the pattern untouched", () => {
    const pattern = /^key/m;
    expect(findOutside("x\nkey", pattern)?.index).toBe(2);
    expect(pattern.lastIndex).toBe(0);
  });

  it("returns null when every match is inside a literal", () => {
    expect(findOutside('"""key""" \'key\'', /key/)).toBeNull();
  });
});

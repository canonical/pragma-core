import { describe, expect, it } from "vitest";
import getNodeText from "./nodeText.js";

describe("getNodeText", () => {
  it("returns the text between from and to", () => {
    expect(getNodeText("hello world", { from: 0, to: 5 })).toBe("hello");
  });

  it("returns middle segment", () => {
    expect(getNodeText("abc def ghi", { from: 4, to: 7 })).toBe("def");
  });

  it("returns empty string for zero-width range", () => {
    expect(getNodeText("abc", { from: 1, to: 1 })).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import createDeclaration from "./createDeclaration.js";
import hasDeclaration from "./hasDeclaration.js";
import createRule from "./rule.js";

describe("hasDeclaration", () => {
  it("returns true when the property exists", () => {
    const list = [createDeclaration("--x", "1"), createDeclaration("--y", "2")];
    expect(hasDeclaration(list, "--x")).toBe(true);
  });

  it("returns false when the property does not exist", () => {
    const list = [createDeclaration("--x", "1")];
    expect(hasDeclaration(list, "--y")).toBe(false);
  });

  it("ignores Rule nodes", () => {
    const list = [createRule([":root"], [createDeclaration("--x", "1")])];
    expect(hasDeclaration(list, "--x")).toBe(false);
  });
});

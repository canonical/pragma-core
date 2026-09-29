import { describe, expect, it } from "vitest";
import createDeclaration from "./createDeclaration.js";
import createRule from "./rule.js";

describe("createRule", () => {
  it("creates a Rule node with empty children by default", () => {
    const rule = createRule([":root"]);
    expect(rule).toEqual({
      type: "Rule",
      prelude: [":root"],
      children: [],
    });
  });

  it("creates a Rule node with children", () => {
    const rule = createRule([":root"], [createDeclaration("--x", "1")]);
    expect(rule.children).toHaveLength(1);
  });
});

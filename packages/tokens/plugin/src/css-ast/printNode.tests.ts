import { describe, expect, it } from "vitest";
import createDeclaration from "./createDeclaration.js";
import printNode from "./printNode.js";
import createRule from "./rule.js";

describe("printNode", () => {
  const opts = { indentChar: "\t", indentLv: 0 };

  it("prints a declaration", () => {
    const out = printNode(createDeclaration("--x", "1"), opts);
    expect(out).toBe("--x: 1;\n");
  });

  it("prints a declaration with comment", () => {
    const out = printNode(createDeclaration("--x", "1", "note"), opts);
    expect(out).toBe("/* note */\n--x: 1;\n");
  });

  it("indents at the given level", () => {
    const out = printNode(createDeclaration("--x", "1"), {
      indentChar: "\t",
      indentLv: 2,
    });
    expect(out).toBe("\t\t--x: 1;\n");
  });

  it("prints a rule with children", () => {
    const out = printNode(
      createRule([":root"], [createDeclaration("--x", "1")]),
      opts,
    );
    expect(out).toContain(":root {");
    expect(out).toContain("\t--x: 1;");
    expect(out).toContain("}");
  });

  it("returns empty string for a rule with no children", () => {
    expect(printNode(createRule([":root"], []), opts)).toBe("");
  });

  it("returns empty string for a rule with no prelude", () => {
    expect(
      printNode(createRule([], [createDeclaration("--x", "1")]), opts),
    ).toBe("");
  });

  it("joins multiple prelude entries with commas", () => {
    const out = printNode(
      createRule([".a", ".b"], [createDeclaration("--x", "1")]),
      opts,
    );
    expect(out).toContain(".a,\n.b {");
  });
});

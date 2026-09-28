import { describe, expect, it } from "vitest";
import createDeclaration from "./createDeclaration.js";
import printRules from "./printRules.js";
import createRule from "./rule.js";

describe("printRules", () => {
  it("prints a :root block with declarations", () => {
    const css = printRules([
      createRule(
        [":root"],
        [createDeclaration("--x", "1"), createDeclaration("--y", "2")],
      ),
    ]);

    expect(css).toContain(":root {");
    expect(css).toContain("--x: 1;");
    expect(css).toContain("--y: 2;");
    expect(css).toContain("}");
  });

  it("prints declaration comments", () => {
    const css = printRules([
      createRule([":root"], [createDeclaration("--x", "1", "primary color")]),
    ]);

    expect(css).toContain("/* primary color */");
    expect(css).toContain("--x: 1;");
  });

  it("prints nested rules (e.g. @layer > :root)", () => {
    const css = printRules([
      createRule(
        ["@layer ds.tokens"],
        [createRule([":root"], [createDeclaration("--x", "1")])],
      ),
    ]);

    expect(css).toContain("@layer ds.tokens {");
    expect(css).toContain(":root {");
    expect(css).toContain("--x: 1;");
  });

  it("skips empty rules", () => {
    const css = printRules([createRule([":root"], [])]);
    expect(css).toBe("");
  });

  it("respects custom indentation", () => {
    const css = printRules(
      [createRule([":root"], [createDeclaration("--x", "1")])],
      {
        indentChar: "    ",
      },
    );

    expect(css).toContain("    --x: 1;");
  });

  it("handles multiple top-level rules with blank lines between them", () => {
    const css = printRules([
      createRule([":root"], [createDeclaration("--x", "1")]),
      createRule([".dark"], [createDeclaration("--x", "2")]),
    ]);

    const lines = css.split("\n");
    const rootEndIndex = lines.indexOf("}");
    const blankIndex = rootEndIndex + 1;
    expect(lines[blankIndex]).toBe("");
  });
});

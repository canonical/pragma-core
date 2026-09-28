/** Tests for `extractPropertyAtPosition()`. */
import { describe, expect, it } from "vitest";
import extractPropertyAtPosition from "./scanners/extractPropertyAtPosition.js";

describe("extractPropertyAtPosition", () => {
  it("extracts simple property name", () => {
    const source = "  padding-left: var(--x);";
    expect(extractPropertyAtPosition(source, { line: 0, character: 22 })).toBe(
      "padding-left",
    );
  });

  it("extracts color property", () => {
    const source = "  background-color: var(--bg);";
    expect(extractPropertyAtPosition(source, { line: 0, character: 26 })).toBe(
      "background-color",
    );
  });

  it("extracts property from multiline source", () => {
    const source = ".foo {\n  color: var(--x);\n  padding: 0;\n}";
    expect(extractPropertyAtPosition(source, { line: 1, character: 14 })).toBe(
      "color",
    );
  });

  it("returns null for selector line", () => {
    const source = ".my-class {\n  color: red;\n}";
    expect(
      extractPropertyAtPosition(source, { line: 0, character: 5 }),
    ).toBeNull();
  });

  it("returns null for custom property declaration", () => {
    const source = "  --my-var: 12px;";
    expect(
      extractPropertyAtPosition(source, { line: 0, character: 14 }),
    ).toBeNull();
  });

  it("returns null when out of bounds", () => {
    const source = "color: red;";
    expect(
      extractPropertyAtPosition(source, { line: 5, character: 0 }),
    ).toBeNull();
  });

  it("handles cursor at property name boundary", () => {
    const source = "  width: var(--x);";
    expect(extractPropertyAtPosition(source, { line: 0, character: 13 })).toBe(
      "width",
    );
  });

  it("handles calc() wrapping var()", () => {
    const source = "  margin: calc(var(--x) + 1px);";
    expect(extractPropertyAtPosition(source, { line: 0, character: 20 })).toBe(
      "margin",
    );
  });

  it("handles shorthand property", () => {
    const source = "  border: 1px solid var(--c);";
    expect(extractPropertyAtPosition(source, { line: 0, character: 24 })).toBe(
      "border",
    );
  });
});

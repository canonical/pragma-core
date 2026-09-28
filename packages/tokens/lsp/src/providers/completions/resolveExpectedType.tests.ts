import { describe, expect, it } from "vitest";
import resolveExpectedType from "./resolveExpectedType.js";

describe("resolveExpectedType", () => {
  it("returns null when source is undefined", () => {
    expect(
      resolveExpectedType(undefined, { line: 0, character: 0 }),
    ).toBeNull();
  });

  it("returns null when position is undefined", () => {
    expect(resolveExpectedType(".a { color: red; }", undefined)).toBeNull();
  });

  it("returns '<color>' for a color property", () => {
    const source = ".a { color: var(--x); }";
    // position on the value portion of the `color` property
    const result = resolveExpectedType(source, { line: 0, character: 12 });
    expect(result).toBe("<color>");
  });

  it("returns null when cursor is not inside a property value", () => {
    const source = ".a { color: red; }";
    // position on the selector
    const result = resolveExpectedType(source, { line: 0, character: 1 });
    expect(result).toBeNull();
  });
});

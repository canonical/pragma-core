import { describe, expect, it } from "vitest";
import extractUnit from "./values/extractUnit.js";

describe("extractUnit", () => {
  it.each([
    ["24px", "px"],
    ["1.5rem", "rem"],
    ["100%", "%"],
    ["90deg", "deg"],
    ["200ms", "ms"],
    ["1fr", "fr"],
  ])('extracts "%s" → "%s"', (value, unit) => {
    expect(extractUnit(value)).toBe(unit);
  });

  it("returns null for unitless values", () => {
    expect(extractUnit("42")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractUnit("")).toBeNull();
  });

  it("returns null for non-numeric values", () => {
    expect(extractUnit("red")).toBeNull();
  });
});

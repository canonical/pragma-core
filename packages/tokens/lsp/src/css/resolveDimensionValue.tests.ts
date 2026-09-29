import { describe, expect, it } from "vitest";
import resolveDimensionValue from "./values/resolveDimensionValue.js";

describe("resolveDimensionValue", () => {
  it.each([
    ["24px", "<length>"],
    ["1.5rem", "<length>"],
    ["2em", "<length>"],
    ["100vw", "<length>"],
    ["50vh", "<length>"],
    ["10ch", "<length>"],
    ["90deg", "<angle>"],
    ["3.14rad", "<angle>"],
    ["200ms", "<time>"],
    ["2s", "<time>"],
    ["440Hz", "<frequency>"],
    ["96dpi", "<resolution>"],
    ["1fr", "<flex>"],
    ["100%", "<percentage>"],
  ])('maps "%s" to %s', (value, type) => {
    expect(resolveDimensionValue(value)).toBe(type);
  });

  it("maps unitless number to <number>", () => {
    expect(resolveDimensionValue("42")).toBe("<number>");
  });
});

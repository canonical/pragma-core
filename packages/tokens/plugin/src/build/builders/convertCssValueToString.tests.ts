import { describe, expect, it } from "vitest";
import convertCssValueToString from "./convertCssValueToString.js";

describe("convertCssValueToString", () => {
  it("returns string values as-is", () => {
    expect(convertCssValueToString("oklch(0.5 0.2 250)")).toBe(
      "oklch(0.5 0.2 250)",
    );
  });

  it('returns "." key for WideGamutColorValue', () => {
    expect(convertCssValueToString({ ".": "rgb(100, 50, 200)" })).toBe(
      "rgb(100, 50, 200)",
    );
  });

  it("returns null for multi-value (typography)", () => {
    expect(
      convertCssValueToString({
        "font-size": "1rem",
        "line-height": "1.5",
      }),
    ).toBeNull();
  });
});

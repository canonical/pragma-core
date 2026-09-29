import { describe, expect, it } from "vitest";
import wrapLightDark from "./wrapLightDark.js";

describe("wrapLightDark", () => {
  it("wraps different values in light-dark()", () => {
    expect(wrapLightDark("oklch(0.5 0.1 200)", "oklch(0.8 0.1 200)")).toBe(
      "light-dark(oklch(0.5 0.1 200), oklch(0.8 0.1 200))",
    );
  });

  it("returns the plain value when light and dark are identical", () => {
    expect(wrapLightDark("#000", "#000")).toBe("#000");
  });

  it("handles empty strings", () => {
    expect(wrapLightDark("", "")).toBe("");
  });

  it("treats whitespace-only differences as different", () => {
    expect(wrapLightDark("a", " a")).toBe("light-dark(a,  a)");
  });
});

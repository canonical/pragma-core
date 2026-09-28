import { describe, expect, it } from "vitest";
import buildFallbackChain from "./buildFallbackChain.js";

describe("buildFallbackChain", () => {
  it("returns modifier → surface → base when both flags set", () => {
    expect(buildFallbackChain("--color-foreground-primary", true, true)).toBe(
      "var(--modifier-color-foreground-primary, var(--surface-color-foreground-primary, var(--color-foreground-primary)))",
    );
  });

  it("returns modifier → base when only hasModifier", () => {
    expect(buildFallbackChain("--color-text", true, false)).toBe(
      "var(--modifier-color-text, var(--color-text))",
    );
  });

  it("returns surface → base when only hasSurface", () => {
    expect(buildFallbackChain("--color-background", false, true)).toBe(
      "var(--surface-color-background, var(--color-background))",
    );
  });

  it("returns simple var() when neither flag set", () => {
    expect(
      buildFallbackChain(
        "--color-foreground-navigation-secondary",
        false,
        false,
      ),
    ).toBe("var(--color-foreground-navigation-secondary)");
  });
});

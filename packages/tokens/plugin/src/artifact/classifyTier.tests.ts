import { describe, expect, it } from "vitest";
import classifyTier from "./classifyTier.js";

describe("classifyTier", () => {
  it('returns "primitive" for the primitive set', () => {
    expect(classifyTier("color.palette.green.520", "primitive")).toBe(
      "primitive",
    );
  });

  it('returns "semantic" for the semantic set', () => {
    expect(classifyTier("color.foreground.primary", "semantic")).toBe(
      "semantic",
    );
  });

  it('returns "semantic" when setName is undefined (fallback)', () => {
    expect(classifyTier("color.foreground.primary", undefined)).toBe(
      "semantic",
    );
  });
});

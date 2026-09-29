/** Tests for fallback staleness comparison. */
import { describe, expect, it } from "vitest";
import compareFallbackStaleness from "./values/compareFallbackStaleness.js";

describe("compareFallbackStaleness", () => {
  it("returns false when fallback equals current value", () => {
    expect(compareFallbackStaleness("16px", "16px", false)).toBe(false);
  });

  it("returns true when non-colour values differ", () => {
    expect(compareFallbackStaleness("16px", "24px", false)).toBe(true);
  });

  it("returns false when current value is null", () => {
    expect(compareFallbackStaleness("16px", null, false)).toBe(false);
  });

  it("returns false for equivalent colours in different formats", () => {
    // #fff and white are the same colour
    expect(compareFallbackStaleness("#ffffff", "white", true)).toBe(false);
  });

  it("returns false for colours within ΔE ≤ 1", () => {
    // Very similar blues — ΔE should be tiny
    expect(compareFallbackStaleness("#0000fe", "#0000ff", true)).toBe(false);
  });

  it("returns true for colours beyond ΔE > 1", () => {
    // Red vs blue — large ΔE
    expect(compareFallbackStaleness("#ff0000", "#0000ff", true)).toBe(true);
  });

  it("returns true when colour cannot be parsed", () => {
    expect(compareFallbackStaleness("not-a-colour", "#fff", true)).toBe(true);
  });

  it("handles oklch colour format", () => {
    expect(
      compareFallbackStaleness("oklch(100% 0 0)", "oklch(100% 0 0)", true),
    ).toBe(false);
  });

  it("detects stale oklch fallback", () => {
    expect(
      compareFallbackStaleness("oklch(50% 0.2 240)", "oklch(90% 0 0)", true),
    ).toBe(true);
  });

  it("ignores leading/trailing whitespace", () => {
    expect(compareFallbackStaleness("  16px  ", "16px", false)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { extractOklchL } from "./extractOklchL.js";

describe("extractOklchL", () => {
  it("extracts L component from oklch value", () => {
    expect(
      extractOklchL({
        colorSpace: "oklch",
        components: [0.5, 0.2, 250],
      }),
    ).toBe(0.5);
  });

  it("returns null for non-oklch colorSpace", () => {
    expect(
      extractOklchL({
        colorSpace: "srgb",
        components: [0.5, 0.2, 0.3],
      }),
    ).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(extractOklchL("oklch(0.5 0.2 250)")).toBeNull();
    expect(extractOklchL(null)).toBeNull();
  });

  it("returns null when components are missing", () => {
    expect(extractOklchL({ colorSpace: "oklch" })).toBeNull();
  });
});

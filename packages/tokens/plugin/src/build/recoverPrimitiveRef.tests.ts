import { describe, expect, it } from "vitest";
import { recoverPrimitiveRef } from "./recoverPrimitiveRef.js";

describe("recoverPrimitiveRef", () => {
  const primitives = new Map([
    ["oklch(0.5 0.2 250)", "--color-palette-blue-50"],
    ["oklch(0.9 0.01 100)", "--color-palette-neutral-10"],
  ]);

  it("replaces literal with var() when primitive match exists", () => {
    const result = recoverPrimitiveRef(
      "oklch(0.5 0.2 250)",
      "--color-foreground-primary",
      primitives,
    );
    expect(result).toBe("var(--color-palette-blue-50)");
  });

  it("returns value unchanged when already a var()", () => {
    const result = recoverPrimitiveRef(
      "var(--color-palette-blue-50)",
      "--color-foreground-primary",
      primitives,
    );
    expect(result).toBe("var(--color-palette-blue-50)");
  });

  it("skips self-references", () => {
    const result = recoverPrimitiveRef(
      "oklch(0.5 0.2 250)",
      "--color-palette-blue-50",
      primitives,
    );
    expect(result).toBe("oklch(0.5 0.2 250)");
  });

  it("returns value unchanged when no match exists", () => {
    const result = recoverPrimitiveRef(
      "oklch(0.3 0.1 200)",
      "--color-foreground-secondary",
      primitives,
    );
    expect(result).toBe("oklch(0.3 0.1 200)");
  });
});

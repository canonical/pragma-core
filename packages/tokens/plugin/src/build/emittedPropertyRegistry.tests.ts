import { describe, expect, it } from "vitest";
import EmittedPropertyRegistry from "./emittedPropertyRegistry.js";

describe("EmittedPropertyRegistry", () => {
  it("allows the same source owner across product contexts", () => {
    const registry = new EmittedPropertyRegistry();
    registry.register(
      "--typography-text-secondary-font-size",
      "typography.text.secondary/font-size",
    );
    expect(() =>
      registry.register(
        "--typography-text-secondary-font-size",
        "typography.text.secondary/font-size",
      ),
    ).not.toThrow();
  });

  it("rejects a composite sub-property colliding with a sibling token", () => {
    const registry = new EmittedPropertyRegistry();
    registry.register(
      "--typography-text-secondary-font-size",
      "typography.text.secondary/font-size",
    );
    expect(() =>
      registry.register(
        "--typography-text-secondary-font-size",
        "typography.text.secondary.fontSize",
      ),
    ).toThrow(/Emitted property collision/);
  });

  it("rejects a compatibility alias colliding with another token", () => {
    const registry = new EmittedPropertyRegistry();
    registry.register(
      "--dimension-size-fontSize-300",
      "dimension.size.fontSize.300::legacy",
    );
    expect(() =>
      registry.register(
        "--dimension-size-fontSize-300",
        "dimension.size.fontSize-300",
      ),
    ).toThrow(/Emitted property collision/);
  });
});

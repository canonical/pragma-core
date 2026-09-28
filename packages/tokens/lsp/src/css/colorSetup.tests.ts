import { describe, expect, it } from "vitest";
import ensureColorSetup from "./colorSetup.js";

describe("ensureColorSetup", () => {
  it("does not throw on first call", () => {
    expect(() => ensureColorSetup()).not.toThrow();
  });

  it("is idempotent — calling twice does not throw", () => {
    ensureColorSetup();
    expect(() => ensureColorSetup()).not.toThrow();
  });
});

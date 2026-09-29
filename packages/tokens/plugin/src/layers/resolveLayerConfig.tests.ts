import { describe, expect, it } from "vitest";
import resolveLayerConfig from "./resolveLayerConfig.js";

describe("resolveLayerConfig", () => {
  it("returns all defaults when called with no arguments", () => {
    const config = resolveLayerConfig();
    expect(config).toEqual({
      tokens: "ds.tokens",
      modifiers: "ds.modifiers",
      surfaces: "ds.surfaces",
      states: "ds.states",
    });
  });

  it("allows overriding individual layers", () => {
    const config = resolveLayerConfig({ tokens: "my.tokens" });
    expect(config.tokens).toBe("my.tokens");
    expect(config.modifiers).toBe("ds.modifiers");
  });

  it("allows setting a layer to null", () => {
    const config = resolveLayerConfig({ tokens: null });
    expect(config.tokens).toBeNull();
    expect(config.modifiers).toBe("ds.modifiers");
  });
});

import { describe, expect, it } from "vitest";
import buildLightDarkDeclarations from "./buildLightDarkDeclarations.js";

describe("buildLightDarkDeclarations", () => {
  it("returns a declaration per pair", () => {
    const result = buildLightDarkDeclarations([
      { property: "--color-bg", light: "#fff", dark: "#000" },
      { property: "--color-fg", light: "#000", dark: "#fff" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "Declaration",
      property: "--color-bg",
      value: "light-dark(#fff, #000)",
    });
    expect(result[1]).toMatchObject({
      type: "Declaration",
      property: "--color-fg",
      value: "light-dark(#000, #fff)",
    });
  });

  it("uses plain value when light === dark", () => {
    const result = buildLightDarkDeclarations([
      { property: "--color-brand", light: "#e95420", dark: "#e95420" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "Declaration",
      property: "--color-brand",
      value: "#e95420",
    });
  });

  it("returns an empty array for empty input", () => {
    expect(buildLightDarkDeclarations([])).toEqual([]);
  });
});

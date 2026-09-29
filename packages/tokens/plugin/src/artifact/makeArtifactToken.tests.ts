import { describe, expect, it } from "vitest";
import makeArtifactToken from "./makeArtifactToken.js";

describe("makeArtifactToken", () => {
  it("creates a complete artifact token with paired values", () => {
    const token = makeArtifactToken({
      cssVar: "--color-foreground-primary",
      id: "color.foreground.primary",
      type: "color",
      tier: "semantic",
      visibility: "public",
      cssOutputFile: "modifiers.theme.css",
      valueLight: "oklch(0.2 0 0)",
      valueDark: "oklch(0.9 0 0)",
    });

    expect(token.cssVar).toBe("--color-foreground-primary");
    expect(token.id).toBe("color.foreground.primary");
    expect(token.type).toBe("color");
    expect(token.tier).toBe("semantic");
    expect(token.isPaired).toBe(true);
    expect(token.cssOutputFile).toBe("modifiers.theme.css");
  });

  it("sets isPaired to false when light === dark", () => {
    const token = makeArtifactToken({
      cssVar: "--color-brand-primary",
      id: "color.brand.primary",
      type: "color",
      tier: "semantic",
      visibility: "public",
      cssOutputFile: "modifiers.theme.css",
      valueLight: "#e95420",
      valueDark: "#e95420",
    });

    expect(token.isPaired).toBe(false);
  });

  it("sets isPaired to false when no values are provided", () => {
    const token = makeArtifactToken({
      cssVar: "--dimension-spacing-small",
      id: "dimension.spacing.small",
      type: "dimension",
      tier: "primitive",
      visibility: "public",
      cssOutputFile: "sets.primitive.css",
    });

    expect(token.isPaired).toBe(false);
    expect(token.valueLight).toBeUndefined();
    expect(token.valueDark).toBeUndefined();
  });

  it("includes optional fields when provided", () => {
    const token = makeArtifactToken({
      cssVar: "--color-bg",
      id: "color.bg",
      type: "color",
      tier: "semantic",
      visibility: "public",
      cssOutputFile: "modifiers.theme.css",
      description: "Background color",
      aliasChain: ["color.palette.white"],
      sourceFile: "semantic/color/light.tokens.json",
      sourceLine: 42,
    });

    expect(token.description).toBe("Background color");
    expect(token.aliasChain).toEqual(["color.palette.white"]);
    expect(token.sourceFile).toBe("semantic/color/light.tokens.json");
    expect(token.sourceLine).toBe(42);
  });
});

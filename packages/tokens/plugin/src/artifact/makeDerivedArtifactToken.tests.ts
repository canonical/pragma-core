import { describe, expect, it } from "vitest";
import makeDerivedArtifactToken from "./makeDerivedArtifactToken.js";

describe("makeDerivedArtifactToken", () => {
  it("creates a derived-tier token with derivation metadata", () => {
    const token = makeDerivedArtifactToken({
      cssVar: "--hover--color-foreground-primary",
      type: "color",
      tier: "derived",
      visibility: "internal",
      cssOutputFile: "states.css",
      derivedFrom: "--color-foreground-primary",
      derivation: "hover",
      valueLight:
        "oklch(from var(--modifier-color-foreground-primary, var(--color-foreground-primary)) calc(l + var(--delta-hover-color-foreground-primary)) c h)",
    });

    expect(token.tier).toBe("derived");
    expect(token.id).toBeNull();
    expect(token.derivedFrom).toBe("--color-foreground-primary");
    expect(token.derivation).toBe("hover");
    expect(token.cssOutputFile).toBe("states.css");
  });

  it("creates a channel-modifier token as semantic tier", () => {
    const token = makeDerivedArtifactToken({
      cssVar: "--modifier-color-foreground-primary",
      type: "color",
      tier: "semantic",
      visibility: "internal",
      cssOutputFile: "modifiers.anticipation.css",
      derivedFrom: "--color-foreground-primary",
      derivation: "channel-modifier",
    });

    expect(token.tier).toBe("semantic");
    expect(token.derivation).toBe("channel-modifier");
  });

  it("creates a delta derived token", () => {
    const token = makeDerivedArtifactToken({
      cssVar: "--delta-hover-color-foreground-primary",
      type: "number",
      tier: "derived",
      visibility: "internal",
      cssOutputFile: "modifiers.theme.css",
      derivedFrom: "--color-foreground-primary",
      derivation: "delta",
      valueLight: "0.05",
      valueDark: "-0.03",
    });

    expect(token.tier).toBe("derived");
    expect(token.derivation).toBe("delta");
    expect(token.isPaired).toBe(true);
  });
});

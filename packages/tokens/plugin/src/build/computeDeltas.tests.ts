import { describe, expect, it } from "vitest";
import type { Artifact } from "../artifact/types.js";
import { computeDeltas } from "./computeDeltas.js";
import EmittedPropertyRegistry from "./emittedPropertyRegistry.js";
import type { ResolverLike } from "./shims.js";

function makeToken(lightness: number) {
  return {
    $value: {
      colorSpace: "oklch",
      components: [lightness, 0.2, 145],
    },
  };
}

describe("computeDeltas", () => {
  it("emits hover and active delta declarations and artifact entries", () => {
    const artifact: Artifact = {};
    const resolver: ResolverLike = {
      apply(input) {
        if (input.theme === "light") {
          return {
            "color.foreground.primary": makeToken(0.5),
            "color.foreground.primary.hover": makeToken(0.56),
            "color.foreground.primary.active": makeToken(0.46),
          };
        }

        return {
          "color.foreground.primary": makeToken(0.8),
          "color.foreground.primary.hover": makeToken(0.75),
          "color.foreground.primary.active": makeToken(0.72),
        };
      },
    };

    const result = computeDeltas(
      {},
      resolver,
      artifact,
      new EmittedPropertyRegistry(),
    );

    expect(result.lightDeltaDecls).toEqual([
      expect.objectContaining({
        property: "--delta-hover-color-foreground-primary",
        value: "0.06",
      }),
      expect.objectContaining({
        property: "--delta-active-color-foreground-primary",
        value: "-0.04",
      }),
    ]);
    expect(result.darkDeltaDecls).toEqual([
      expect.objectContaining({
        property: "--delta-hover-color-foreground-primary",
        value: "-0.05",
      }),
      expect.objectContaining({
        property: "--delta-active-color-foreground-primary",
        value: "-0.08",
      }),
    ]);
    expect(artifact["--delta-hover-color-foreground-primary"]).toMatchObject({
      derivedFrom: "--color-foreground-primary",
      derivation: "delta",
      valueLight: "0.06",
      valueDark: "-0.05",
    });
  });

  it("skips disabled states because they do not use delta declarations", () => {
    const artifact: Artifact = {};
    const resolver: ResolverLike = {
      apply() {
        return {
          "color.foreground.checkbox.checkmark": makeToken(0.5),
          "color.foreground.checkbox.checkmark.disabled": makeToken(0.2),
        };
      },
    };

    const result = computeDeltas(
      {},
      resolver,
      artifact,
      new EmittedPropertyRegistry(),
    );

    expect(result.lightDeltaDecls).toEqual([]);
    expect(result.darkDeltaDecls).toEqual([]);
    expect(Object.keys(artifact)).toEqual([]);
  });

  it("skips entries with non-oklch values", () => {
    const artifact: Artifact = {};
    const resolver: ResolverLike = {
      apply(input) {
        if (input.theme === "light") {
          return {
            "color.foreground.primary": { $value: "oklch(0.5 0.2 145)" },
            "color.foreground.primary.hover": makeToken(0.56),
          };
        }

        return {
          "color.foreground.primary": makeToken(0.8),
          "color.foreground.primary.hover": makeToken(0.75),
        };
      },
    };

    const result = computeDeltas(
      {},
      resolver,
      artifact,
      new EmittedPropertyRegistry(),
    );

    expect(result.lightDeltaDecls).toEqual([]);
    expect(result.darkDeltaDecls).toEqual([]);
  });
});

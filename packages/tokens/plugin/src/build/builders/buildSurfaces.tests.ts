import { describe, expect, it, vi } from "vitest";
import EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { OutputFileFn, ResolverLike } from "../shims.js";
import buildSurfaces from "./buildSurfaces.js";

/**
 * A resolver with two surface contexts and one token that moves in each.
 * Enough to reach the emission checks; nothing here exercises resolution.
 */
function makeResolver(): ResolverLike {
  return {
    apply(input: Record<string, string>) {
      const ctx = input.surface;
      return {
        "color.text": {
          $value: {
            colorSpace: "oklch",
            components: ctx ? [0.9, 0, 0] : [0.5, 0, 0],
          },
          $type: "color",
          aliasChain: ctx ? [`color.text.${ctx}`] : ["color.text"],
        },
      };
    },
    source: {
      modifiers: {
        surface: { contexts: { none: {}, layer1: {}, layer2: {} } },
      },
    },
  } as unknown as ResolverLike;
}

const layers = {
  tokens: null,
  modifiers: null,
  surfaces: null,
  states: null,
};

function run(surfaceEmits?: Record<string, readonly string[]>) {
  const outputFile: OutputFileFn = vi.fn();
  return buildSurfaces(
    makeResolver(),
    layers,
    {},
    outputFile,
    "./tokens/canonical",
    new EmittedPropertyRegistry(),
    { layer1: ".surface", layer2: ".surface .surface" },
    surfaceEmits,
  );
}

describe("buildSurfaces — the declared emission set", () => {
  it("accepts a set that names exactly the live contexts", () => {
    expect(() =>
      run({ layer1: ["color-text"], layer2: ["color-text"] }),
    ).not.toThrow();
  });

  it("rejects a set that misses a context", () => {
    // Silent otherwise: layer2 would go on inferring its emission from the
    // source's shape, which is the behaviour declaring the set removes.
    expect(() => run({ layer1: ["color-text"] })).toThrow(/missing layer2/);
  });

  it("rejects a set naming a context that does not exist", () => {
    // Silent otherwise: the key is never visited, so a renamed or removed
    // context leaves a declaration nothing checks.
    expect(() =>
      run({
        layer1: ["color-text"],
        layer2: ["color-text"],
        layer3: ["color-text"],
      }),
    ).toThrow(/unknown layer3/);
  });

  it("rejects an empty set outright", () => {
    expect(() => run({})).toThrow(/missing layer1, layer2/);
  });
});

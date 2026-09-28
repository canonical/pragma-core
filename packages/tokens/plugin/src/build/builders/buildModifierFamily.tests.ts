import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../../artifact/types.js";
import EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { OutputFileFn, ResolverLike } from "../shims.js";
import buildModifierFamily from "./buildModifierFamily.js";

describe("buildModifierFamily", () => {
  it("derives artifact type from a dimension-valued source token", () => {
    const resolver: ResolverLike = {
      source: {
        modifiers: {
          density: { contexts: { compact: [] } },
        },
      },
      apply(input) {
        return {
          "spacing.component.inset": {
            $type: "dimension",
            $value: input.density === "compact" ? "0.5rem" : "1rem",
          },
        };
      },
    };
    const artifact: Artifact = {};
    const outputFile = vi.fn<OutputFileFn>();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    buildModifierFamily(
      "density",
      resolver,
      {
        tokens: "ds.tokens",
        modifiers: "ds.modifiers",
        surfaces: "ds.surfaces",
        states: "ds.states",
      },
      artifact,
      outputFile,
      "/missing-test-token-directory",
      new EmittedPropertyRegistry(),
    );

    expect(artifact["--modifier-spacing-component-inset"]).toMatchObject({
      type: "dimension",
      visibility: "internal",
      derivedFrom: "--spacing-component-inset",
    });
    warning.mockRestore();
  });
});

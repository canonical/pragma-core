import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../../artifact/types.js";
import EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  TokenLike,
} from "../shims.js";
import buildTheme from "./buildTheme.js";

function makeTransform(
  id: string,
  value: string,
  input: Record<string, string> = {},
) {
  return {
    id,
    localID: `--${id.replaceAll(".", "-")}`,
    type: "SINGLE_VALUE" as const,
    value,
    input,
    token: {
      $type: "color",
      $description: `${id} description`,
      source: { filename: "/global/semantic/color/light.tokens.json" },
    },
  };
}

describe("buildTheme", () => {
  it("emits theme CSS and semantic artifact entries", () => {
    const artifact: Artifact = {
      "--color-palette-green-520": {
        cssVar: "--color-palette-green-520",
        id: "color.palette.green.520",
        type: "color",
        tier: "primitive",
        isPaired: false,
        cssOutputFile: "sets.primitive.css",
        valueLight: "oklch(0.52 0.2 145)",
        valueDark: "oklch(0.52 0.2 145)",
      },
    };
    const getTransforms: GetTransformsFn = ({ input }) => {
      if (input?.theme === "dark") {
        return [
          makeTransform("color.foreground.primary", "oklch(0.75 0.2 145)", {
            theme: "dark",
          }),
        ];
      }

      return [
        makeTransform("color.foreground.primary", "oklch(0.52 0.2 145)"),
        makeTransform("dimension.spacing.small", "4px"),
      ];
    };
    const resolver: ResolverLike = {
      apply(input) {
        if (input.theme === "light" || input.theme === "dark") {
          return {};
        }
        return {};
      },
    };
    const outputFile = vi.fn<OutputFileFn>();

    buildTheme(
      {} as Record<string, TokenLike>,
      getTransforms,
      resolver,
      {
        tokens: "ds.tokens",
        modifiers: "ds.modifiers",
        surfaces: "ds.surfaces",
        states: "ds.states",
      },
      artifact,
      outputFile,
      undefined,
      new EmittedPropertyRegistry(),
    );

    expect(artifact["--color-foreground-primary"]).toMatchObject({
      id: "color.foreground.primary",
      tier: "semantic",
      cssOutputFile: "modifiers.theme.css",
      valueLight: "var(--color-palette-green-520)",
      valueDark: "oklch(0.75 0.2 145)",
    });
    expect(outputFile).toHaveBeenCalledWith(
      "modifiers.theme.css",
      expect.stringContaining("@layer ds.modifiers"),
    );
    const css = outputFile.mock.calls[0][1] as string;
    expect(css).toContain(":root {");
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toContain(".light {");
    expect(css).toContain(".dark {");
    // @media block is omitted when there are no dark deltas (mock has none).
    // When present, it must NOT set color-scheme — that would override .light
    // by source order on dark-mode systems (same specificity 0,1,0).
    expect(css).not.toContain("@media");
  });
});

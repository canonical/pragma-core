import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../../artifact/types.js";
import EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { GetTransformsFn, OutputFileFn, ResolverLike } from "../shims.js";
import buildTypography from "./buildTypography.js";

/** A resolver whose apply() returns the given tokens for every permutation. */
function makeResolver(tokens: Record<string, unknown>): ResolverLike {
  return {
    apply: (input) => {
      if (input.product) return {};
      return Object.fromEntries(
        Object.entries(tokens).map(([id, token]) => [
          id,
          {
            $type: "typography",
            source: {
              filename:
                "/global/semantic/modifier/typography/global.tokens.json",
            },
            ...(token as Record<string, unknown>),
          },
        ]),
      ) as never;
    },
  };
}

/** A smallcaps `$extensions` block as the resolver hands it to the builder. */
const SMALLCAPS_EXT = {
  "com.canonical.typography": {
    $value: {
      letterCase: {
        $ref: "#/typography/letterCase/smallcaps/$extensions/com.canonical.typography/$value",
      },
    },
  },
};

function makeSingle(
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
      $type: "typography",
      $description: `${id} description`,
      source: {
        filename: "/global/semantic/modifier/typography/global.tokens.json",
      },
    },
  };
}

function makeMulti(
  id: string,
  value: Record<string, string>,
  input: Record<string, string> = {},
) {
  return {
    id,
    localID: `--${id.replaceAll(".", "-")}`,
    type: "MULTI_VALUE" as const,
    value,
    input,
    token: {
      $type: "typography",
      $description: `${id} description`,
      source: {
        filename: "/global/semantic/modifier/typography/global.tokens.json",
      },
    },
  };
}

describe("buildTypography", () => {
  it("emits root and context typography CSS", () => {
    const artifact: Artifact = {};
    const getTransforms: GetTransformsFn = ({ input }) => {
      if (input?.product === "app") {
        return [
          makeSingle("typography.heading.large", "800", { product: "app" }),
        ];
      }
      if (input?.product) {
        return [];
      }
      return [
        makeSingle("typography.heading.large", "700"),
        makeMulti("typography.body.default", {
          "font-size": "1rem",
          "line-height": "1.5rem",
        }),
      ];
    };
    const outputFile = vi.fn<OutputFileFn>();

    buildTypography(
      getTransforms,
      makeResolver({}),
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

    expect(outputFile).toHaveBeenCalledWith(
      "modifiers.typography.css",
      expect.any(String),
    );
    const css = outputFile.mock.calls[0][1] as string;
    expect(css).toContain(":root {");
    expect(css).toContain(".app {");
    expect(css).toContain("--typography-heading-large: 700;");
    expect(css).toContain("--typography-body-default-font-size: 1rem;");
    expect(css).toContain("--typography-heading-large: 800;");
    expect(artifact["--typography-heading-large"]).toBeDefined();
    expect(artifact["--typography-body-default-font-size"]).toBeDefined();
  });

  it("emits font-variant from the canonical typography $extensions", () => {
    const artifact: Artifact = {};
    const getTransforms: GetTransformsFn = ({ input }) =>
      input?.product
        ? []
        : [
            makeMulti("typography.heading.5", {
              "font-size": "1rem",
              "line-height": "1.5rem",
            }),
          ];
    const outputFile = vi.fn<OutputFileFn>();

    buildTypography(
      getTransforms,
      // The resolver hands the builder heading.5 with a resolved smallcaps ref.
      makeResolver({ "typography.heading.5": { $extensions: SMALLCAPS_EXT } }),
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

    const css = outputFile.mock.calls[0][1] as string;
    expect(css).toContain("--typography-heading-5-font-variant: small-caps;");
    expect(artifact["--typography-heading-5-font-variant"]).toBeDefined();
  });

  it("emits typography that exists only in a non-default product", () => {
    const artifact: Artifact = {};
    const resolver: ResolverLike = {
      apply(input) {
        if (input.product !== "site") return {};
        return {
          "typography.heading.display": {
            $type: "typography",
            $value: {
              fontFamily: ["Ubuntu Sans"],
              fontSize: { value: 5.25, unit: "rem" },
              fontWeight: 300,
              lineHeight: 1.1429,
              letterSpacing: { value: 0, unit: "rem" },
            },
            $extensions: {
              "com.canonical.typography": {
                $value: {
                  lineHeightDimension: { value: 6, unit: "rem" },
                },
              },
            },
            source: {
              filename:
                "/global/semantic/modifier/typography/sites.tokens.json",
            },
          },
        };
      },
    };
    const outputFile = vi.fn<OutputFileFn>();

    buildTypography(
      () => [],
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

    const css = outputFile.mock.calls[0][1] as string;
    expect(css).not.toMatch(/:root\s*\{[^}]*heading-display/s);
    expect(css).toMatch(
      /\.site\s*\{[^}]*--typography-heading-display-line-height-dimension: 6rem;/s,
    );
  });

  it("omits product selectors whose declarations equal the default", () => {
    const artifact: Artifact = {};
    const transform = makeMulti("typography.text.primary", {
      "font-size": "1rem",
      "line-height": "1.5",
    });
    const resolver: ResolverLike = {
      apply: () => ({
        "typography.text.primary": {
          $type: "typography",
          source: {
            filename: "/global/semantic/modifier/typography/global.tokens.json",
          },
        },
      }),
    };
    const outputFile = vi.fn<OutputFileFn>();

    buildTypography(
      ({ input }) => [{ ...transform, input: input ?? {} }],
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

    const css = outputFile.mock.calls[0][1] as string;
    expect(css).toContain(":root {");
    for (const context of ["app", "docs", "site", "os"]) {
      expect(css).not.toContain(`.${context} {`);
    }
  });
});

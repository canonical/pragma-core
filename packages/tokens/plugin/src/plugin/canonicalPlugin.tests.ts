import { describe, expect, it, vi } from "vitest";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  SetTransformFn,
  TokenMap,
} from "../build/shims.js";
import canonicalPlugin from "./canonicalPlugin.js";

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
      $type: id.startsWith("typography.") ? "typography" : "color",
      $description: id,
      source: {
        filename: id.startsWith("color.palette.")
          ? "/global/primitive/color.tokens.json"
          : id.startsWith("typography.")
            ? "/global/semantic/modifier/typography/global.tokens.json"
            : "/global/semantic/color/light.tokens.json",
      },
    },
  };
}

describe("canonicalPlugin", () => {
  it("exposes the expected plugin name", () => {
    expect(canonicalPlugin().name).toBe("@canonical/terrazzo-plugin-css");
  });

  it("builds CSS files and the artifact output", async () => {
    const plugin = canonicalPlugin({ families: [] });
    const outputs = new Map<string, string | Uint8Array>();
    const outputFile: OutputFileFn = vi.fn((file, contents) => {
      outputs.set(file, contents);
    });
    const resolver: ResolverLike = {
      apply(input): TokenMap {
        if (input.theme === "dark") {
          return {
            "color.foreground.primary": {
              $value: { colorSpace: "oklch", components: [0.8, 0.2, 145] },
              $type: "color",
            },
          };
        }
        if (input.theme === "light") {
          return {
            "color.foreground.primary": {
              $value: { colorSpace: "oklch", components: [0.5, 0.2, 145] },
              $type: "color",
            },
          };
        }
        return {
          "color.foreground.primary": {
            $value: { colorSpace: "oklch", components: [0.5, 0.2, 145] },
            $type: "color",
          },
        };
      },
      source: {},
    };
    const getTransforms: GetTransformsFn = ({ input }) => {
      if (input?.theme === "dark") {
        return [
          makeTransform("color.foreground.primary", "oklch(0.8 0.2 145)", {
            theme: "dark",
          }),
        ];
      }
      if (
        input?.typography === "app" ||
        input?.typography === "docs" ||
        input?.typography === "site"
      ) {
        return [];
      }
      return [
        makeTransform("color.palette.green.520", "oklch(0.52 0.2 145)"),
        makeTransform("color.foreground.primary", "oklch(0.52 0.2 145)"),
      ];
    };

    await plugin.build({
      tokens: {} as TokenMap,
      getTransforms,
      resolver,
      outputFile,
    });

    expect(outputs.has("sets.primitive.css")).toBe(true);
    expect(outputs.has("sets.semantic.css")).toBe(true);
    expect(outputs.has("modifiers.theme.css")).toBe(true);
    expect(outputs.has("modifiers.spacing.css")).toBe(true);
    expect(outputs.has("modifiers.typography.css")).toBe(true);
    expect(outputs.has("states.css")).toBe(true);
    expect(outputs.has("tokens.json")).toBe(true);
    expect(String(outputs.get("tokens.json"))).toContain(
      "--color-foreground-primary",
    );
  });

  it("registers transforms during the transform hook", async () => {
    const plugin = canonicalPlugin();
    const setCalls: Array<{
      id: string;
      localID?: string;
      input?: Record<string, string>;
    }> = [];
    const setTransform: SetTransformFn = (id, params) => {
      setCalls.push({ id, localID: params.localID, input: params.input });
    };
    const resolver: ResolverLike = {
      apply(input): TokenMap {
        if (input.theme === "dark") {
          return {
            "color.foreground.primary": {
              $type: "color",
              $value: "oklch(0.8 0.2 145)",
            },
          };
        }
        if (
          input.product === "app" ||
          input.product === "docs" ||
          input.product === "site" ||
          input.product === "os"
        ) {
          return {
            "typography.heading.large": {
              $type: "typography",
              $value: "700",
              source: {
                filename:
                  "/global/semantic/modifier/typography/global.tokens.json",
              },
            },
          };
        }
        return {
          "color.foreground.primary": {
            $type: "color",
            $value: "oklch(0.52 0.2 145)",
          },
          "typography.heading.large": {
            $type: "typography",
            $value: "600",
            source: {
              filename:
                "/global/semantic/modifier/typography/global.tokens.json",
            },
          },
        };
      },
    };

    await plugin.transform({
      tokens: {
        "typography.heading.large": {
          $type: "typography",
          source: {
            filename: "/global/semantic/modifier/typography/global.tokens.json",
          },
        },
      },
      setTransform,
      resolver,
    });

    expect(
      setCalls.some((call) => call.id === "color.foreground.primary"),
    ).toBe(true);
    expect(setCalls.some((call) => call.input?.theme === "dark")).toBe(true);
    expect(setCalls.some((call) => call.input?.product === "app")).toBe(true);
  });

  it("registers spacing transforms for every product context", async () => {
    const plugin = canonicalPlugin();
    const setCalls: Array<{
      id: string;
      input?: Record<string, string>;
    }> = [];
    const spacing = {
      $type: "dimension",
      $value: { value: 0.5, unit: "rem" },
      source: { filename: "/global/semantic/spacing/base.tokens.json" },
    };
    const resolver: ResolverLike = {
      apply: () => ({ "spacing.baseline": spacing }),
      source: {
        modifiers: {
          product: {
            contexts: { global: [], app: [], docs: [], site: [], os: [] },
          },
        },
      },
    };

    await plugin.transform({
      tokens: { "spacing.baseline": spacing },
      resolver,
      setTransform(id, params) {
        setCalls.push({ id, input: params.input });
      },
    });

    expect(
      setCalls
        .filter(({ id }) => id === "spacing.baseline")
        .map(({ input }) => input?.product)
        .filter(Boolean),
    ).toEqual(["app", "docs", "site", "os"]);
  });

  it("routes a supplied surface selector into the emitted CSS", async () => {
    // Proves the option is READ, not merely accepted: a selector nothing else
    // would produce has to appear in the output.
    const plugin = canonicalPlugin({
      families: [],
      profile: { surfaceSelectors: { layer1: ".from-the-profile" } },
    });
    const outputs = new Map<string, string | Uint8Array>();
    const outputFile: OutputFileFn = vi.fn((file, contents) => {
      outputs.set(file, contents);
    });
    const resolver: ResolverLike = {
      apply(input): TokenMap {
        return {
          "color.text": {
            $value: {
              colorSpace: "oklch",
              components:
                input.surface === "layer1" ? [0.9, 0, 0] : [0.5, 0, 0],
            },
            $type: "color",
            aliasChain:
              input.surface === "layer1"
                ? ["color.text.layer1"]
                : ["color.text"],
          },
        } as unknown as TokenMap;
      },
      source: {
        modifiers: { surface: { contexts: { none: {}, layer1: {} } } },
      },
    } as unknown as ResolverLike;

    await plugin.build({
      tokens: {} as TokenMap,
      getTransforms: (() => []) as unknown as GetTransformsFn,
      resolver,
      outputFile,
    });

    expect(String(outputs.get("modifiers.surfaces.css"))).toContain(
      ".from-the-profile",
    );
  });

  it("leaves the contexts a partial profile does not name at their defaults", async () => {
    // The regression this guards: naming one context used to REPLACE the whole
    // map, so layer2 fell back to its bare class name ".layer2" — a different
    // DOM depth than ".surface .surface", silently.
    const plugin = canonicalPlugin({
      families: [],
      profile: { surfaceSelectors: { layer1: ".only-this-one" } },
    });
    const outputs = new Map<string, string | Uint8Array>();
    const outputFile: OutputFileFn = vi.fn((file, contents) => {
      outputs.set(file, contents);
    });
    const resolver: ResolverLike = {
      apply(input): TokenMap {
        return {
          "color.text": {
            $value: {
              colorSpace: "oklch",
              components: input.surface ? [0.9, 0, 0] : [0.5, 0, 0],
            },
            $type: "color",
            aliasChain: input.surface
              ? [`color.text.${input.surface}`]
              : ["color.text"],
          },
        } as unknown as TokenMap;
      },
      source: {
        modifiers: {
          surface: { contexts: { none: {}, layer1: {}, layer2: {} } },
        },
      },
    } as unknown as ResolverLike;

    await plugin.build({
      tokens: {} as TokenMap,
      getTransforms: (() => []) as unknown as GetTransformsFn,
      resolver,
      outputFile,
    });

    const css = String(outputs.get("modifiers.surfaces.css"));
    expect(css).toContain(".only-this-one");
    expect(css).toContain(".surface .surface");
  });

  it("routes supplied contract roles into states.css", async () => {
    const plugin = canonicalPlugin({
      families: [],
      contracts: {
        roles: [
          {
            role: "color.invented.forThisTest",
            states: ["hover"],
            hasSurface: false,
            hasModifier: false,
          },
        ],
      },
    });
    const outputs = new Map<string, string | Uint8Array>();
    const outputFile: OutputFileFn = vi.fn((file, contents) => {
      outputs.set(file, contents);
    });

    await plugin.build({
      tokens: {} as TokenMap,
      getTransforms: (() => []) as unknown as GetTransformsFn,
      resolver: { apply: () => ({}), source: {} } as unknown as ResolverLike,
      outputFile,
    });

    const states = String(outputs.get("states.css"));
    expect(states).toContain("--hover--color-invented-for-this-test");
    // And the compiled defaults are NOT also emitted: the option replaces them.
    expect(states).not.toContain("--hover--color-foreground-primary");
  });
});

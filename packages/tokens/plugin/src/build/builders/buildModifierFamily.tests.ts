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

  const baseTokens = {
    "color.text.$root": {
      aliasChain: ["color.palette.black"],
      aliasOf: "color.palette.black",
    },
    "color.border.$root": {
      aliasChain: ["color.palette.grey.300"],
      aliasOf: "color.palette.grey.300",
    },
  };

  it("emits a .default rule rebinding each channel to its base token", () => {
    const resolver: ResolverLike = {
      source: {
        modifiers: {
          criticality: {
            contexts: { none: [], default: [], success: [] },
          },
        },
      },
      apply(input) {
        if (input.criticality === "success") {
          return {
            ...baseTokens,
            "color.text.$root": {
              aliasChain: ["color.text.success"],
              aliasOf: "color.text.success",
            },
          };
        }
        return { ...baseTokens };
      },
    };
    const outputFile = vi.fn<OutputFileFn>();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    buildModifierFamily(
      "criticality",
      resolver,
      {
        tokens: "ds.tokens",
        modifiers: "ds.modifiers",
        surfaces: "ds.surfaces",
        states: "ds.states",
      },
      {},
      outputFile,
      "/missing-test-token-directory",
      new EmittedPropertyRegistry(),
    );

    const css = outputFile.mock.calls[0]?.[1] ?? "";
    expect(css).toContain(".success");
    expect(css).toContain("--modifier-color-text: var(--color-text-success)");
    expect(css).toContain(".default");
    expect(css).toContain("--modifier-color-text: var(--color-text)");
    expect(css).not.toContain("--modifier-color-border: var(--color-border)");
    warning.mockRestore();
  });

  it("emits no .default rule when the family declares no default context", () => {
    const resolver: ResolverLike = {
      source: {
        modifiers: {
          criticality: { contexts: { none: [], success: [] } },
        },
      },
      apply(input) {
        if (input.criticality === "success") {
          return {
            ...baseTokens,
            "color.text.$root": {
              aliasChain: ["color.text.success"],
              aliasOf: "color.text.success",
            },
          };
        }
        return { ...baseTokens };
      },
    };
    const outputFile = vi.fn<OutputFileFn>();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    buildModifierFamily(
      "criticality",
      resolver,
      {
        tokens: "ds.tokens",
        modifiers: "ds.modifiers",
        surfaces: "ds.surfaces",
        states: "ds.states",
      },
      {},
      outputFile,
      "/missing-test-token-directory",
      new EmittedPropertyRegistry(),
    );

    const css = outputFile.mock.calls[0]?.[1] ?? "";
    expect(css).toContain(".success");
    expect(css).not.toContain(".default");
    warning.mockRestore();
  });

  it("emits no .default rule when the family emits no channels", () => {
    const resolver: ResolverLike = {
      source: {
        modifiers: {
          importance: { contexts: { none: [], default: [], primary: [] } },
        },
      },
      apply() {
        return { ...baseTokens };
      },
    };
    const outputFile = vi.fn<OutputFileFn>();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    buildModifierFamily(
      "importance",
      resolver,
      {
        tokens: "ds.tokens",
        modifiers: "ds.modifiers",
        surfaces: "ds.surfaces",
        states: "ds.states",
      },
      {},
      outputFile,
      "/missing-test-token-directory",
      new EmittedPropertyRegistry(),
    );

    const css = outputFile.mock.calls[0]?.[1] ?? "";
    expect(css).not.toContain(".default");
    warning.mockRestore();
  });
});

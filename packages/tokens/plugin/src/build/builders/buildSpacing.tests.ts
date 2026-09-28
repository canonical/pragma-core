import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../../artifact/types.js";
import type { ResolvedLayerConfig } from "../../layers/types.js";
import EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { GetTransformsFn, OutputFileFn, ResolverLike } from "../shims.js";
import buildSpacing from "./buildSpacing.js";

const layers: ResolvedLayerConfig = {
  tokens: "ds.tokens",
  modifiers: "ds.modifiers",
  surfaces: "ds.surfaces",
  states: "ds.states",
};

const values: Record<string, string> = {
  global: "0.5rem",
  app: "0.25rem",
  docs: "0.25rem",
  site: "0.5rem",
  os: "0.25rem",
};

const token = {
  $type: "dimension",
  source: {
    filename: "/global/semantic/spacing/base.tokens.json",
  },
};

describe("buildSpacing", () => {
  it("emits the unscoped Site default and all four explicit product contexts", () => {
    const resolver: ResolverLike = {
      apply(input) {
        return {
          "spacing.baseline": {
            ...token,
            $value: values[input.product ?? "global"],
          },
        };
      },
      source: {
        modifiers: {
          product: {
            contexts: { global: [], app: [], docs: [], site: [], os: [] },
          },
        },
      },
    };
    const getTransforms: GetTransformsFn = ({ input }) => [
      {
        id: "spacing.baseline",
        type: "SINGLE_VALUE",
        value: values[input?.product ?? "global"],
        input: input ?? {},
        token,
      },
    ];
    const artifact: Artifact = {};
    const outputFile = vi.fn<OutputFileFn>();

    buildSpacing(
      getTransforms,
      resolver,
      layers,
      artifact,
      outputFile,
      undefined,
      new EmittedPropertyRegistry(),
    );

    const css = outputFile.mock.calls[0][1] as string;
    expect(css).toMatch(/:root\s*\{[^}]*--spacing-baseline: 0\.5rem/s);
    expect(css).toMatch(/\.site\s*\{[^}]*--spacing-baseline: 0\.5rem/s);
    for (const context of ["app", "docs", "os"]) {
      expect(css).toMatch(
        new RegExp(
          `\\.${context}\\s*\\{[^}]*--spacing-baseline: 0\\.25rem`,
          "s",
        ),
      );
    }
    expect(css).not.toContain("@media");
    expect(css).not.toContain(".dense");
    expect(css).not.toContain(".comfortable");
    expect(artifact["--spacing-baseline"]).toMatchObject({
      id: "spacing.baseline",
      tier: "semantic",
      visibility: "public",
      cssOutputFile: "modifiers.spacing.css",
      valueLight: "0.5rem",
    });
  });

  it("rejects a composite value under spacing", () => {
    const resolver: ResolverLike = {
      apply: () => ({ "spacing.bad": token }),
    };
    const getTransforms: GetTransformsFn = () => [
      {
        id: "spacing.bad",
        type: "MULTI_VALUE",
        value: { inline: "1rem" },
        input: {},
        token,
      },
    ];

    expect(() =>
      buildSpacing(
        getTransforms,
        resolver,
        layers,
        {},
        vi.fn<OutputFileFn>(),
        undefined,
        new EmittedPropertyRegistry(),
      ),
    ).toThrow(/Expected scalar spacing token spacing\.bad/);
  });

  it("rejects duplicate spacing transforms from the build pipeline", () => {
    const resolver: ResolverLike = {
      apply: () => ({ "spacing.baseline": token }),
    };
    const transform = {
      id: "spacing.baseline",
      type: "SINGLE_VALUE" as const,
      value: "0.5rem",
      input: {},
      token,
    };
    const getTransforms: GetTransformsFn = () => [transform, transform];

    expect(() =>
      buildSpacing(
        getTransforms,
        resolver,
        layers,
        {},
        vi.fn<OutputFileFn>(),
        undefined,
        new EmittedPropertyRegistry(),
      ),
    ).toThrow(/Duplicate spacing transform spacing\.baseline/);
  });
});

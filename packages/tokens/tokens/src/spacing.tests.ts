import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "@terrazzo/parser";
import { describe, expect, it } from "vitest";

const CANONICAL = join(import.meta.dirname, "../tokens/canonical");
const RESOLVER = join(CANONICAL, "canonical.resolver.json");
const PRODUCT_BASELINE_CONTRACT = join(
  import.meta.dirname,
  "../contracts/productBaseline.json",
);

const SPACING_IDS = [
  "spacing.baseline",
  "spacing.gap.field.block",
  "spacing.gap.mark.inline",
  "spacing.gap.group.block",
  "spacing.gap.pattern.block",
  "spacing.gap.region.block",
  "spacing.inset.field.inline",
  "spacing.inset.action.inline",
  "spacing.inset.continuation.inline",
  "spacing.inset.surface.inline",
  "spacing.inset.surface.block",
  "spacing.inset.strip.block",
] as const;

const EXPECTED: Record<
  "site" | "docs" | "app" | "os",
  Record<(typeof SPACING_IDS)[number], number>
> = {
  site: {
    "spacing.baseline": 0.5,
    "spacing.gap.field.block": 0.5,
    "spacing.gap.mark.inline": 0.5,
    "spacing.gap.group.block": 1.5,
    "spacing.gap.pattern.block": 4,
    "spacing.gap.region.block": 8,
    "spacing.inset.field.inline": 0.5,
    "spacing.inset.action.inline": 1,
    "spacing.inset.continuation.inline": 2,
    "spacing.inset.surface.inline": 1,
    "spacing.inset.surface.block": 1,
    "spacing.inset.strip.block": 4,
  },
  docs: {
    "spacing.baseline": 0.25,
    "spacing.gap.field.block": 0.5,
    "spacing.gap.mark.inline": 0.5,
    "spacing.gap.group.block": 1.5,
    "spacing.gap.pattern.block": 3,
    "spacing.gap.region.block": 6,
    "spacing.inset.field.inline": 0.5,
    "spacing.inset.action.inline": 0.75,
    "spacing.inset.continuation.inline": 1.5,
    "spacing.inset.surface.inline": 1,
    "spacing.inset.surface.block": 1,
    "spacing.inset.strip.block": 3,
  },
  app: {
    "spacing.baseline": 0.25,
    "spacing.gap.field.block": 0.5,
    "spacing.gap.mark.inline": 0.25,
    "spacing.gap.group.block": 0.5,
    "spacing.gap.pattern.block": 1,
    "spacing.gap.region.block": 2,
    "spacing.inset.field.inline": 0.25,
    "spacing.inset.action.inline": 0.75,
    "spacing.inset.continuation.inline": 1.5,
    "spacing.inset.surface.inline": 0.75,
    "spacing.inset.surface.block": 0.75,
    "spacing.inset.strip.block": 3,
  },
  os: {
    "spacing.baseline": 0.25,
    "spacing.gap.field.block": 0.25,
    "spacing.gap.mark.inline": 0.25,
    "spacing.gap.group.block": 1.5,
    "spacing.gap.pattern.block": 3,
    "spacing.gap.region.block": 6,
    "spacing.inset.field.inline": 0.25,
    "spacing.inset.action.inline": 0.5,
    "spacing.inset.continuation.inline": 1.25,
    "spacing.inset.surface.inline": 0.5,
    "spacing.inset.surface.block": 0.5,
    "spacing.inset.strip.block": 2,
  },
};

const parsed = parse(
  [
    {
      filename: pathToFileURL(RESOLVER),
      src: readFileSync(RESOLVER, "utf8"),
    },
  ],
  { skipLint: true },
);

describe("product spacing resolver", () => {
  it("pins the canonical build-time product baseline requirement", () => {
    expect(JSON.parse(readFileSync(PRODUCT_BASELINE_CONTRACT, "utf8"))).toEqual(
      { requireProductBaseline: true },
    );
  });

  for (const product of ["site", "docs", "app", "os"] as const) {
    it(`resolves every ${product} value point-wise`, async () => {
      const { resolver } = await parsed;
      const tokens = resolver.apply({ product });
      const spacingIds = Object.keys(tokens)
        .filter((id) => id.startsWith("spacing."))
        .sort();

      expect(spacingIds).toEqual([...SPACING_IDS].sort());
      for (const id of SPACING_IDS) {
        expect(tokens[id].$type, `${product}:${id}`).toBe("dimension");
        expect(tokens[id].$value, `${product}:${id}`).toEqual({
          value: EXPECTED[product][id],
          unit: "rem",
        });
      }
    });
  }

  it("keeps horizontal spacing independent of baseline and typography", async () => {
    const { resolver } = await parsed;
    for (const product of ["site", "docs", "app", "os"] as const) {
      const tokens = resolver.apply({ product });
      for (const id of SPACING_IDS.filter((id) => id.endsWith(".inline"))) {
        expect(tokens[id].aliasChain, `${product}:${id}`).toHaveLength(1);
        expect(tokens[id].aliasChain[0], `${product}:${id}`).toMatch(
          /^dimension\.[0-9]+$/,
        );
      }
    }
  });

  it("leaves no breakpoint-owned or competing baseline token", async () => {
    const { resolver } = await parsed;
    for (const breakpoint of ["small", "medium", "large", "xLarge"]) {
      const tokens = resolver.apply({ breakpoint, product: "site" });
      expect(tokens["dimension.size.height.baseline"]).toBeUndefined();
      expect(
        Object.keys(tokens).filter(
          (id) => id.endsWith(".baseline") && id !== "spacing.baseline",
        ),
      ).toEqual([]);
    }
  });

  it("retains the approved Site display correction", async () => {
    const { resolver } = await parsed;
    const tokens = resolver.apply({ product: "site" });
    const display = tokens["typography.heading.display"];
    expect((display.$value as { fontSize: unknown }).fontSize).toEqual({
      value: 5.25,
      unit: "rem",
    });
    expect(display.$extensions).toMatchObject({
      "com.canonical.typography": {
        $value: {
          lineHeightDimension: { $ref: "#/dimension/1200/$value" },
        },
      },
    });
    expect(tokens["dimension.1200"].$value).toEqual({
      value: 6,
      unit: "rem",
    });
    expect(6 / 0.5).toBe(12);
  });
});

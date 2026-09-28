import { describe, expect, it } from "vitest";
import {
  assertUniqueCssVarNames,
  convertLegacyTokenIdToCssVar,
  convertTokenIdToCssVar,
  legacyCssVarForToken,
  prefixVar,
} from "./naming.js";

describe("convertTokenIdToCssVar", () => {
  it("converts dots to hyphens and prepends --", () => {
    expect(convertTokenIdToCssVar("color.foreground.primary")).toBe(
      "--color-foreground-primary",
    );
  });

  it("strips the .$root terminal", () => {
    expect(convertTokenIdToCssVar("color.textOnForegroundPrimary.$root")).toBe(
      "--color-text-on-foreground-primary",
    );
  });

  it("converts camelCase segments to lowercase kebab-case", () => {
    expect(convertTokenIdToCssVar("typography.fontFamily.default")).toBe(
      "--typography-font-family-default",
    );
  });

  it("handles numeric segments", () => {
    expect(convertTokenIdToCssVar("typography.heading.1.fontSize")).toBe(
      "--typography-heading-1-font-size",
    );
  });

  it("handles single-segment ID", () => {
    expect(convertTokenIdToCssVar("backdrop")).toBe("--backdrop");
  });

  it("handles $root as the only segment after the base", () => {
    expect(convertTokenIdToCssVar("border.$root")).toBe("--border");
  });

  it("handles palette tokens with deep nesting", () => {
    expect(convertTokenIdToCssVar("color.palette.green.520")).toBe(
      "--color-palette-green-520",
    );
  });

  it("does not strip $root if it appears in the middle", () => {
    expect(convertTokenIdToCssVar("a.$root.b")).toBe("--a-$root-b");
  });

  it("normalizes acronym, underscore, and whitespace boundaries", () => {
    expect(convertTokenIdToCssVar("type.HTTPLabel.icon_name")).toBe(
      "--type-http-label-icon-name",
    );
  });

  it("exposes a bounded alias only for a changed legacy spelling", () => {
    expect(convertLegacyTokenIdToCssVar("typography.fontFamily.default")).toBe(
      "--typography-fontFamily-default",
    );
    expect(legacyCssVarForToken("typography.fontFamily.default")).toBe(
      "--typography-fontFamily-default",
    );
    expect(legacyCssVarForToken("color.foreground.primary")).toBeUndefined();
  });

  it("fails deterministically when normalized names collide", () => {
    expect(() =>
      assertUniqueCssVarNames(["spacing.iconLabel", "spacing.icon-label"]),
    ).toThrow(/CSS property collision/);
  });

  it("maps the approved spacing vocabulary to twelve unique public names", () => {
    const ids = [
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
    ];

    expect(() => assertUniqueCssVarNames(ids)).not.toThrow();
    expect(ids.map(convertTokenIdToCssVar)).toEqual([
      "--spacing-baseline",
      "--spacing-gap-field-block",
      "--spacing-gap-mark-inline",
      "--spacing-gap-group-block",
      "--spacing-gap-pattern-block",
      "--spacing-gap-region-block",
      "--spacing-inset-field-inline",
      "--spacing-inset-action-inline",
      "--spacing-inset-continuation-inline",
      "--spacing-inset-surface-inline",
      "--spacing-inset-surface-block",
      "--spacing-inset-strip-block",
    ]);
  });

  it("rejects a normalized collision with a public spacing name", () => {
    expect(() =>
      assertUniqueCssVarNames([
        "spacing.gap.mark.inline",
        "spacing.gap.markInline",
      ]),
    ).toThrow(/spacing\.gap\.mark\.inline and spacing\.gap\.markInline/);
  });
});

describe("prefixVar", () => {
  it("inserts the prefix after --", () => {
    expect(prefixVar("--color-foreground-primary", "modifier")).toBe(
      "--modifier-color-foreground-primary",
    );
  });

  it("works with surface prefix", () => {
    expect(prefixVar("--color-background-layer2", "surface")).toBe(
      "--surface-color-background-layer2",
    );
  });

  it("works with delta prefix", () => {
    expect(prefixVar("--hover-color-foreground-primary", "delta")).toBe(
      "--delta-hover-color-foreground-primary",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  classifySourceRole,
  isPrimitive,
  isSemanticColor,
  isSemanticSpacing,
  isSemanticTypography,
} from "./classification.js";

const source = (filename: string, $type?: string) => ({
  $type,
  source: { filename },
});

describe("classification", () => {
  it("uses the resolver source path rather than the identifier namespace", () => {
    expect(
      classifySourceRole(source("tokens/global/semantic/dimension/a.json")),
    ).toBe("semantic");
    expect(
      classifySourceRole(source("tokens/global/primitive/custom/a.json")),
    ).toBe("primitive");
  });

  it("prefers the resolver source catalog when runtime provenance is flattened", () => {
    const catalog = {
      get: (id: string) =>
        id === "dimension.component.gap"
          ? {
              role: "semantic" as const,
              sourceFile: "global/semantic/spacing.tokens.json",
            }
          : undefined,
    };
    expect(
      classifySourceRole(
        { source: { filename: "canonical.resolver.json" } },
        "dimension.component.gap",
        catalog,
      ),
    ).toBe("semantic");
  });

  describe("isPrimitive", () => {
    it("accepts color.palette.*", () => {
      expect(isPrimitive(source("/global/primitive/color.tokens.json"))).toBe(
        true,
      );
    });

    it("accepts dimension.*", () => {
      expect(
        isPrimitive(source("/global/primitive/dimension.tokens.json")),
      ).toBe(true);
    });

    it("accepts typography.fontFamily.*", () => {
      expect(
        isPrimitive(source("/global/primitive/typography.tokens.json")),
      ).toBe(true);
    });

    it("accepts typography.fontWeight.*", () => {
      expect(
        isPrimitive(source("/global/primitive/typography.tokens.json")),
      ).toBe(true);
    });

    it("rejects semantic colour", () => {
      expect(
        isPrimitive(source("/global/semantic/color/light.tokens.json")),
      ).toBe(false);
    });

    it("rejects semantic typography", () => {
      expect(
        isPrimitive(
          source("/global/semantic/modifier/typography/global.tokens.json"),
        ),
      ).toBe(false);
    });
  });

  describe("isSemanticColor", () => {
    it("accepts color.foreground.*", () => {
      expect(
        isSemanticColor(
          source("/global/semantic/color/light.tokens.json", "color"),
        ),
      ).toBe(true);
    });

    it("rejects color.palette.*", () => {
      expect(
        isSemanticColor(source("/global/primitive/color.tokens.json", "color")),
      ).toBe(false);
    });

    it("rejects non-color", () => {
      expect(
        isSemanticColor(
          source("/global/semantic/dimension/small.tokens.json", "dimension"),
        ),
      ).toBe(false);
    });
  });

  describe("isSemanticTypography", () => {
    it("accepts typography.heading.*", () => {
      expect(
        isSemanticTypography(
          source(
            "/global/semantic/modifier/typography/global.tokens.json",
            "typography",
          ),
        ),
      ).toBe(true);
    });

    it("rejects primitive typography", () => {
      expect(
        isSemanticTypography(
          source("/global/primitive/typography.tokens.json", "typography"),
        ),
      ).toBe(false);
    });

    it("rejects non-typography", () => {
      expect(
        isSemanticTypography(
          source("/global/semantic/color/light.tokens.json", "color"),
        ),
      ).toBe(false);
    });
  });

  describe("isSemanticSpacing", () => {
    it("accepts semantic dimension tokens in the spacing namespace", () => {
      expect(
        isSemanticSpacing(
          source("/global/semantic/spacing/base.tokens.json", "dimension"),
          "spacing.gap.field.block",
        ),
      ).toBe(true);
    });

    it("rejects breakpoint dimensions and non-dimension spacing tokens", () => {
      expect(
        isSemanticSpacing(
          source("/global/semantic/dimension/small.tokens.json", "dimension"),
          "dimension.size.height.baseline",
        ),
      ).toBe(false);
      expect(
        isSemanticSpacing(
          source("/global/semantic/spacing/base.tokens.json", "number"),
          "spacing.baseline",
        ),
      ).toBe(false);
    });
  });
});

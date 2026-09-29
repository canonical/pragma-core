import { describe, expect, it } from "vitest";
import { typographyExtensionDecls } from "./typographyExtensions.js";

const ext = (value: Record<string, unknown>) => ({
  "com.canonical.typography": { $value: value },
});

const ref = (path: string) => ({ $ref: `#/typography/${path}/$extensions/x` });

describe("typographyExtensionDecls", () => {
  it("maps a smallcaps letterCase ref to font-variant", () => {
    expect(
      typographyExtensionDecls(
        ext({ letterCase: ref("letterCase/smallcaps") }),
      ),
    ).toEqual({ "font-variant": "small-caps" });
  });

  it("maps an oldStyleFigure figureStyle ref to font-variant-numeric", () => {
    expect(
      typographyExtensionDecls(
        ext({ figureStyle: ref("figureStyle/oldStyleFigure") }),
      ),
    ).toEqual({ "font-variant-numeric": "oldstyle-nums" });
  });

  it("emits both properties when both refs are present", () => {
    expect(
      typographyExtensionDecls(
        ext({
          letterCase: ref("letterCase/smallcaps"),
          figureStyle: ref("figureStyle/liningFigures"),
        }),
      ),
    ).toEqual({
      "font-variant": "small-caps",
      "font-variant-numeric": "lining-nums",
    });
  });

  it("emits an exact dimension reference for line-height", () => {
    expect(
      typographyExtensionDecls(
        ext({ lineHeightDimension: { $ref: "#/dimension/300/$value" } }),
      ),
    ).toEqual({ "line-height-dimension": "var(--dimension-300)" });
  });

  it("accepts a resolved DTCG dimension value", () => {
    expect(
      typographyExtensionDecls(
        ext({ lineHeightDimension: { value: 1.25, unit: "rem" } }),
      ),
    ).toEqual({ "line-height-dimension": "1.25rem" });
  });

  it("omits the default/normal letterCase (equals the CSS initial value)", () => {
    expect(
      typographyExtensionDecls(ext({ letterCase: ref("letterCase/default") })),
    ).toEqual({});
  });

  it("returns {} when there is no canonical typography extension", () => {
    expect(typographyExtensionDecls(undefined)).toEqual({});
    expect(typographyExtensionDecls({})).toEqual({});
    expect(typographyExtensionDecls({ "other.ext": {} })).toEqual({});
  });
});

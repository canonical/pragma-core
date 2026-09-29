import { describe, expect, it } from "vitest";
import mapDtcgType from "./values/mapDtcgType.js";

describe("mapDtcgType", () => {
  it.each([
    ["color", "<color>"],
    ["number", "<number>"],
    ["fontFamily", "<family-name>"],
    ["fontWeight", "<number>"],
    ["duration", "<time>"],
    ["cubicBezier", "<easing-function>"],
    ["gradient", "<gradient>"],
  ] as const)("maps %s to %s", (dtcg, css) => {
    expect(mapDtcgType(dtcg)).toBe(css);
  });

  it.each([
    "border",
    "shadow",
    "typography",
    "transition",
    "strokeStyle",
  ] as const)("maps composite type %s to <unknown>", (dtcg) => {
    expect(mapDtcgType(dtcg)).toBe("<unknown>");
  });

  it("maps null to <unknown>", () => {
    expect(mapDtcgType(null)).toBe("<unknown>");
  });

  it("maps dimension to <unknown> (no unit info from type alone)", () => {
    expect(mapDtcgType("dimension")).toBe("<unknown>");
  });
});

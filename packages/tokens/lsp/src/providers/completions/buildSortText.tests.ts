import { describe, expect, it } from "vitest";
import { makeTokenNode } from "../../testing/index.js";
import { buildSortText, contextMatchScore } from "./buildSortText.js";

describe("contextMatchScore", () => {
  it("returns '0' when types are assignable", () => {
    expect(contextMatchScore("<color>", "<color>")).toBe("0");
  });

  it("returns '1' when expectedType is null", () => {
    expect(contextMatchScore("<color>", null)).toBe("1");
  });

  it("returns '1' when cssType is unknown", () => {
    expect(contextMatchScore("<unknown>", "<color>")).toBe("1");
  });

  it("returns '2' when types are not assignable", () => {
    expect(contextMatchScore("<length>", "<color>")).toBe("2");
  });
});

describe("buildSortText", () => {
  it("encodes context, provenance, tier, type, and name", () => {
    const token = makeTokenNode({
      cssVar: "--accent",
      tier: "semantic",
      type: "color",
    });
    const result = buildSortText("0", "A", "--accent", token);
    expect(result).toBe("0_A_0_color_accent");
  });

  it("uses default tier group for unknown tiers", () => {
    const token = makeTokenNode({
      cssVar: "--x",
      tier: "custom" as "semantic",
      type: "number",
    });
    const result = buildSortText("1", "B", "--x", token);
    expect(result).toContain("_1_"); // default tier sort
  });

  it("uses 'zzz' for null type", () => {
    const token = makeTokenNode({ cssVar: "--x", type: null });
    const result = buildSortText("0", "A", "--x", token);
    expect(result).toContain("_zzz_");
  });
});

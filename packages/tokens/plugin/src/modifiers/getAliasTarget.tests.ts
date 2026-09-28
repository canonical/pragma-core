import { describe, expect, it } from "vitest";
import getAliasTarget from "./getAliasTarget.js";

describe("getAliasTarget", () => {
  it("returns DTCG aliasOf when present", () => {
    expect(getAliasTarget({ aliasOf: "color.blue.500" })).toBe(
      "color.blue.500",
    );
  });

  it("returns undefined when aliasOf is absent", () => {
    expect(getAliasTarget({})).toBeUndefined();
  });
});

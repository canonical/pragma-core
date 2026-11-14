import { describe, expect, it } from "vitest";
import assertDefined from "./assertDefined.js";

describe("assertDefined", () => {
  it("returns a defined value", () => {
    expect(assertDefined(0, "count")).toBe(0);
  });

  it("throws naming what is missing", () => {
    expect(() => assertDefined(undefined, "count")).toThrow("Missing count");
  });
});

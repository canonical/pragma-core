import { describe, expect, it } from "vitest";
import isAssignable from "./values/isAssignable.js";

describe("isAssignable", () => {
  it("accepts same type", () => {
    expect(isAssignable("<color>", "<color>")).toBe(true);
    expect(isAssignable("<length>", "<length>")).toBe(true);
  });

  it("rejects incompatible types", () => {
    expect(isAssignable("<color>", "<length>")).toBe(false);
    expect(isAssignable("<angle>", "<time>")).toBe(false);
  });

  it("accepts <unknown> on either side (conservative suppression)", () => {
    expect(isAssignable("<unknown>", "<color>")).toBe(true);
    expect(isAssignable("<color>", "<unknown>")).toBe(true);
  });

  describe("subtype relations", () => {
    it("<length> is assignable to <length-percentage>", () => {
      expect(isAssignable("<length>", "<length-percentage>")).toBe(true);
    });

    it("<percentage> is assignable to <length-percentage>", () => {
      expect(isAssignable("<percentage>", "<length-percentage>")).toBe(true);
    });

    it("<integer> is assignable to <number>", () => {
      expect(isAssignable("<integer>", "<number>")).toBe(true);
    });

    it("<number> is assignable to <alpha-value>", () => {
      expect(isAssignable("<number>", "<alpha-value>")).toBe(true);
    });

    it("<percentage> is assignable to <alpha-value>", () => {
      expect(isAssignable("<percentage>", "<alpha-value>")).toBe(true);
    });

    it("<gradient> is assignable to <image>", () => {
      expect(isAssignable("<gradient>", "<image>")).toBe(true);
    });

    it("<url> is assignable to <image>", () => {
      expect(isAssignable("<url>", "<image>")).toBe(true);
    });
  });

  it("subtype relation is not commutative", () => {
    expect(isAssignable("<length-percentage>", "<length>")).toBe(false);
    expect(isAssignable("<number>", "<integer>")).toBe(false);
  });
});

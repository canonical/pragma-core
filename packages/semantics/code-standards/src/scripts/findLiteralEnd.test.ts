import { describe, expect, it } from "vitest";
import findLiteralEnd from "./findLiteralEnd.js";

describe("findLiteralEnd", () => {
  it("ends a short literal at its first unescaped quote", () => {
    expect(findLiteralEnd('"a \\" b" ;', 0)).toEqual({
      raw: 'a \\" b',
      end: 8,
    });
  });

  it("ends a long literal at its closing three quotes", () => {
    expect(findLiteralEnd("'''a ' b''' .", 0)).toEqual({
      raw: "a ' b",
      end: 11,
    });
  });

  it("keeps up to two quotes before a long literal's closing three", () => {
    expect(findLiteralEnd('"""a"""""', 0)).toEqual({ raw: 'a""', end: 9 });
    expect(findLiteralEnd('"""a""""""', 0)).toEqual({ raw: 'a""', end: 9 });
  });

  it("refuses a short literal that runs into a line break", () => {
    expect(() => findLiteralEnd('"a\nb"', 0)).toThrow("Unterminated literal");
  });

  it("refuses a literal with no closing quote", () => {
    expect(() => findLiteralEnd('x """open', 2)).toThrow(
      "Unterminated literal",
    );
  });
});

import { describe, expect, it } from "vitest";
import parseSyntaxType from "./parseSyntaxType.js";

describe("parseSyntaxType", () => {
  it("returns a known CSS type for a simple descriptor", () => {
    expect(parseSyntaxType("<color>")).toBe("<color>");
    expect(parseSyntaxType("<length>")).toBe("<length>");
    expect(parseSyntaxType("<number>")).toBe("<number>");
  });

  it("trims whitespace", () => {
    expect(parseSyntaxType("  <color>  ")).toBe("<color>");
  });

  it("returns <unknown> for unrecognised syntax", () => {
    expect(parseSyntaxType("<custom-ident>")).toBe("<unknown>");
    expect(parseSyntaxType("foo")).toBe("<unknown>");
  });

  it('returns <unknown> for universal "*" syntax', () => {
    expect(parseSyntaxType("*")).toBe("<unknown>");
  });

  it("resolves a union to the first known member", () => {
    expect(parseSyntaxType("<length> | <percentage>")).toBe("<length>");
    expect(parseSyntaxType("<custom-ident> | <color>")).toBe("<color>");
  });

  it("returns <unknown> when no union member is known", () => {
    expect(parseSyntaxType("<custom-ident> | <transform-function>")).toBe(
      "<unknown>",
    );
  });

  it('strips the "#" list multiplier', () => {
    expect(parseSyntaxType("<color>#")).toBe("<color>");
    expect(parseSyntaxType("<length>#")).toBe("<length>");
  });

  it('strips the "+" list multiplier', () => {
    expect(parseSyntaxType("<length>+")).toBe("<length>");
  });

  it("handles union with multipliers", () => {
    expect(parseSyntaxType("<length># | <percentage>")).toBe("<length>");
  });
});

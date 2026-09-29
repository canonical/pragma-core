import { describe, expect, it } from "vitest";
import inferValueType from "./values/inferValueType.js";

describe("inferValueType", () => {
  // ── Hex colours ──────────────────────────────────────────────
  it("classifies 3-digit hex as <color>", () => {
    expect(inferValueType("#fff")).toBe("<color>");
  });

  it("classifies 4-digit hex (with alpha) as <color>", () => {
    expect(inferValueType("#ff0f")).toBe("<color>");
  });

  it("classifies 6-digit hex as <color>", () => {
    expect(inferValueType("#e95420")).toBe("<color>");
  });

  it("classifies 8-digit hex (with alpha) as <color>", () => {
    expect(inferValueType("#e9542080")).toBe("<color>");
  });

  // ── Colour functions ─────────────────────────────────────────
  it("classifies rgb() as <color>", () => {
    expect(inferValueType("rgb(255, 0, 0)")).toBe("<color>");
  });

  it("classifies rgba() as <color>", () => {
    expect(inferValueType("rgba(255, 0, 0, 0.5)")).toBe("<color>");
  });

  it("classifies hsl() as <color>", () => {
    expect(inferValueType("hsl(120, 100%, 50%)")).toBe("<color>");
  });

  it("classifies hsla() as <color>", () => {
    expect(inferValueType("hsla(120, 100%, 50%, 0.3)")).toBe("<color>");
  });

  it("classifies oklch() as <color>", () => {
    expect(inferValueType("oklch(0.7 0.15 30)")).toBe("<color>");
  });

  it("classifies oklab() as <color>", () => {
    expect(inferValueType("oklab(0.5 0.1 -0.1)")).toBe("<color>");
  });

  it("classifies lab() as <color>", () => {
    expect(inferValueType("lab(50 30 -20)")).toBe("<color>");
  });

  it("classifies lch() as <color>", () => {
    expect(inferValueType("lch(50 30 270)")).toBe("<color>");
  });

  it("classifies hwb() as <color>", () => {
    expect(inferValueType("hwb(120 10% 20%)")).toBe("<color>");
  });

  it("classifies color() as <color>", () => {
    expect(inferValueType("color(display-p3 1 0.5 0)")).toBe("<color>");
  });

  it("classifies light-dark() as <color>", () => {
    expect(inferValueType("light-dark(#fff, #000)")).toBe("<color>");
  });

  it("classifies color-mix() as <color>", () => {
    expect(inferValueType("color-mix(in srgb, red 40%, blue)")).toBe("<color>");
  });

  it("classifies colour functions case-insensitively", () => {
    expect(inferValueType("RGB(0, 0, 0)")).toBe("<color>");
    expect(inferValueType("OKLCH(0.7 0.15 30)")).toBe("<color>");
  });

  // ── Named colour keywords ────────────────────────────────────
  it("classifies transparent as <color>", () => {
    expect(inferValueType("transparent")).toBe("<color>");
  });

  it("classifies currentColor (case-insensitive) as <color>", () => {
    expect(inferValueType("currentColor")).toBe("<color>");
    expect(inferValueType("currentcolor")).toBe("<color>");
  });

  // ── Dimension units ──────────────────────────────────────────
  it("classifies px as <length>", () => {
    expect(inferValueType("16px")).toBe("<length>");
  });

  it("classifies rem as <length>", () => {
    expect(inferValueType("1.5rem")).toBe("<length>");
  });

  it("classifies em as <length>", () => {
    expect(inferValueType("2em")).toBe("<length>");
  });

  it("classifies viewport units as <length>", () => {
    expect(inferValueType("100vw")).toBe("<length>");
    expect(inferValueType("50vh")).toBe("<length>");
  });

  it("classifies dynamic viewport units as <length>", () => {
    expect(inferValueType("100dvw")).toBe("<length>");
    expect(inferValueType("100dvh")).toBe("<length>");
    expect(inferValueType("100svh")).toBe("<length>");
    expect(inferValueType("100lvh")).toBe("<length>");
  });

  it("classifies container query units as <length>", () => {
    expect(inferValueType("50cqw")).toBe("<length>");
    expect(inferValueType("50cqh")).toBe("<length>");
    expect(inferValueType("50cqi")).toBe("<length>");
    expect(inferValueType("50cqb")).toBe("<length>");
  });

  it("classifies other length units", () => {
    expect(inferValueType("10cm")).toBe("<length>");
    expect(inferValueType("5mm")).toBe("<length>");
    expect(inferValueType("2in")).toBe("<length>");
    expect(inferValueType("12pt")).toBe("<length>");
    expect(inferValueType("1ch")).toBe("<length>");
    expect(inferValueType("1lh")).toBe("<length>");
  });

  it("classifies % as <percentage>", () => {
    expect(inferValueType("50%")).toBe("<percentage>");
  });

  it("classifies angle units as <angle>", () => {
    expect(inferValueType("90deg")).toBe("<angle>");
    expect(inferValueType("1.57rad")).toBe("<angle>");
    expect(inferValueType("100grad")).toBe("<angle>");
    expect(inferValueType("0.25turn")).toBe("<angle>");
  });

  it("classifies time units as <time>", () => {
    expect(inferValueType("200ms")).toBe("<time>");
    expect(inferValueType("0.5s")).toBe("<time>");
  });

  it("classifies frequency units as <frequency>", () => {
    expect(inferValueType("440Hz")).toBe("<frequency>");
    expect(inferValueType("2kHz")).toBe("<frequency>");
  });

  it("classifies resolution units as <resolution>", () => {
    expect(inferValueType("96dpi")).toBe("<resolution>");
    expect(inferValueType("2dppx")).toBe("<resolution>");
    expect(inferValueType("2x")).toBe("<resolution>");
  });

  it("classifies fr as <flex>", () => {
    expect(inferValueType("1fr")).toBe("<flex>");
  });

  it("classifies negative dimensions", () => {
    expect(inferValueType("-1px")).toBe("<length>");
    expect(inferValueType("-0.5rem")).toBe("<length>");
  });

  // ── Bare numbers ─────────────────────────────────────────────
  it("classifies bare integers as <number>", () => {
    expect(inferValueType("0")).toBe("<number>");
    expect(inferValueType("42")).toBe("<number>");
  });

  it("classifies bare decimals as <number>", () => {
    expect(inferValueType("0.5")).toBe("<number>");
    expect(inferValueType("3.14")).toBe("<number>");
  });

  it("classifies negative numbers as <number>", () => {
    expect(inferValueType("-1")).toBe("<number>");
    expect(inferValueType("-0.75")).toBe("<number>");
  });

  // ── Global keywords ──────────────────────────────────────────
  it("classifies inherit as <unknown>", () => {
    expect(inferValueType("inherit")).toBe("<unknown>");
  });

  it("classifies initial as <unknown>", () => {
    expect(inferValueType("initial")).toBe("<unknown>");
  });

  it("classifies unset as <unknown>", () => {
    expect(inferValueType("unset")).toBe("<unknown>");
  });

  it("classifies revert as <unknown>", () => {
    expect(inferValueType("revert")).toBe("<unknown>");
  });

  it("classifies revert-layer as <unknown>", () => {
    expect(inferValueType("revert-layer")).toBe("<unknown>");
  });

  // ── Unknown strings ──────────────────────────────────────────
  it("classifies arbitrary strings as <unknown>", () => {
    expect(inferValueType("hello")).toBe("<unknown>");
  });

  it("classifies multi-word values as <unknown>", () => {
    expect(inferValueType("1px solid red")).toBe("<unknown>");
  });

  it("classifies empty string as <unknown>", () => {
    expect(inferValueType("")).toBe("<unknown>");
  });

  it("trims whitespace before classification", () => {
    expect(inferValueType("  #fff  ")).toBe("<color>");
    expect(inferValueType("  16px  ")).toBe("<length>");
  });
});

import { describe, expect, it } from "vitest";
import scanUsages from "./scanners/scanUsages.js";

describe("scanUsages", () => {
  it("scans a simple var() usage", () => {
    const source = `.box { color: var(--color-fg); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages).toHaveLength(1);
    expect(usages[0].cssVar).toBe("--color-fg");
    expect(usages[0].property).toBe("color");
    expect(usages[0].fallback).toBeNull();
  });

  it("scans var() with fallback", () => {
    const source = `.box { color: var(--color-fg, red); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages[0].fallback).toBe("red");
  });

  it("scans multiple var() on the same line", () => {
    const source = `.box { border: var(--size) solid var(--color); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages).toHaveLength(2);
    expect(usages[0].cssVar).toBe("--size");
    expect(usages[1].cssVar).toBe("--color");
  });

  it("tracks line numbers", () => {
    const source = `.box {
  color: var(--a);
  width: var(--b);
}`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages[0].line).toBe(1);
    expect(usages[1].line).toBe(2);
  });

  it("detects the CSS property name", () => {
    const source = `  background-color: var(--bg);`;
    const usages = scanUsages(source, "file:///bg.css");
    expect(usages[0].property).toBe("background-color");
  });

  it("scans multi-line var() calls", () => {
    const source = `.chip {
  background-color: var(
    --modifier-color-tinted,
    var(--chip-color-background)
  );
}`;
    const usages = scanUsages(source, "file:///chip.css");
    expect(usages).toHaveLength(2);
    expect(usages[0].cssVar).toBe("--modifier-color-tinted");
    expect(usages[0].property).toBe("background-color");
    expect(usages[0].fallback).toBe("var(--chip-color-background)");
    expect(usages[1].cssVar).toBe("--chip-color-background");
    expect(usages[1].property).toBe("background-color");
    expect(usages[1].fallback).toBeNull();
  });

  it("scans nested var() with correct fallbacks", () => {
    const source = `.box { border-color: var(--a, var(--b)); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages).toHaveLength(2);
    expect(usages[0].cssVar).toBe("--a");
    expect(usages[0].fallback).toBe("var(--b)");
    expect(usages[1].cssVar).toBe("--b");
    expect(usages[1].fallback).toBeNull();
  });

  it("tracks varNameColumn and varNameLength", () => {
    //                 0123456789012345678
    const source = `.box { color: var(--color-fg); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages).toHaveLength(1);
    // "var(" starts at column 14, "--color-fg" starts at column 18
    expect(usages[0].column).toBe(14);
    expect(usages[0].varNameColumn).toBe(18);
    expect(usages[0].varNameLength).toBe("--color-fg".length);
  });

  it("tracks varNameColumn with whitespace after var(", () => {
    const source = `.box { color: var(  --spaced ); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages).toHaveLength(1);
    expect(usages[0].cssVar).toBe("--spaced");
    // "var(" at 14, then two spaces, "--spaced" at 20
    expect(usages[0].column).toBe(14);
    expect(usages[0].varNameColumn).toBe(20);
    expect(usages[0].varNameLength).toBe("--spaced".length);
  });

  it("scans nested var() inside calc()", () => {
    const source = `.box { width: calc(var(--size, var(--fallback)) + 1px); }`;
    const usages = scanUsages(source, "file:///box.css");
    expect(usages).toHaveLength(2);
    expect(usages[0]).toMatchObject({
      cssVar: "--size",
      property: "width",
      fallback: "var(--fallback)",
    });
    expect(usages[1]).toMatchObject({
      cssVar: "--fallback",
      property: "width",
      fallback: null,
    });
  });

  it("does not match var() text inside string literals", () => {
    const source = '.box::before { content: "var(--fake)"; }';
    expect(scanUsages(source, "file:///box.css")).toEqual([]);
  });
});

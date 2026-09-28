import { describe, expect, it } from "vitest";
import extractCssImports from "./extractCssImports.js";

describe("extractCssImports", () => {
  it("extracts bare string @import", () => {
    const css = '@import "tokens.css";';
    expect(extractCssImports(css)).toEqual(["tokens.css"]);
  });

  it("extracts url() @import", () => {
    const css = '@import url("tokens.css");';
    expect(extractCssImports(css)).toEqual(["tokens.css"]);
  });

  it("extracts url() @import without quotes", () => {
    const css = "@import url(tokens.css);";
    expect(extractCssImports(css)).toEqual(["tokens.css"]);
  });

  it("extracts single-quoted @import", () => {
    const css = "@import 'tokens.css';";
    expect(extractCssImports(css)).toEqual(["tokens.css"]);
  });

  it("extracts multiple @imports", () => {
    const css = [
      '@import "a.css";',
      '@import "b.css";',
      '@import "c.css";',
    ].join("\n");
    expect(extractCssImports(css)).toEqual(["a.css", "b.css", "c.css"]);
  });

  it("ignores @import with media query (still extracts path)", () => {
    const css = '@import "print.css" print;';
    expect(extractCssImports(css)).toEqual(["print.css"]);
  });

  it("ignores @import with layer", () => {
    const css = '@import "tokens.css" layer(base);';
    expect(extractCssImports(css)).toEqual(["tokens.css"]);
  });

  it("returns empty for CSS with no imports", () => {
    const css = ".button { color: red; }";
    expect(extractCssImports(css)).toEqual([]);
  });

  it("ignores commented-out @imports", () => {
    const css = '/* @import "old.css"; */\n@import "new.css";';
    expect(extractCssImports(css)).toEqual(["new.css"]);
  });

  it("ignores @import-like text inside string literals", () => {
    const css = '.note::before { content: "@import "fake.css";"; }';
    expect(extractCssImports(css)).toEqual([]);
  });
});

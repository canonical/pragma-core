import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeTokenNode as makeToken } from "../../testing/index.js";
import resolveToLiteral from "./resolveToLiteral.js";

describe("resolveToLiteral", () => {
  it("resolves nested aliases to their terminal literal", () => {
    const graph = new TokenGraph();
    graph.addToken(
      makeToken({
        cssVar: "--color-bg",
        valueLight: "var(--color-brand-primary)",
        valueDark: "var(--color-brand-primary)",
      }),
    );
    graph.addToken(
      makeToken({
        cssVar: "--color-brand-primary",
        valueLight: "var(--color-palette-orange)",
        valueDark: "var(--color-palette-orange)",
      }),
    );
    graph.addToken(
      makeToken({
        cssVar: "--color-palette-orange",
        valueLight: "#e95420",
        valueDark: "#e95420",
      }),
    );

    expect(resolveToLiteral("var(--color-bg)", graph, "light")).toBe("#e95420");
  });

  it("uses the requested mode when following paired values", () => {
    const graph = new TokenGraph();
    graph.addToken(
      makeToken({
        cssVar: "--surface-color",
        valueLight: "var(--surface-light)",
        valueDark: "var(--surface-dark)",
        isPaired: true,
      }),
    );
    graph.addToken(
      makeToken({
        cssVar: "--surface-light",
        valueLight: "#ffffff",
        valueDark: "#ffffff",
      }),
    );
    graph.addToken(
      makeToken({
        cssVar: "--surface-dark",
        valueLight: "#111111",
        valueDark: "#111111",
      }),
    );

    expect(resolveToLiteral("var(--surface-color)", graph, "dark")).toBe(
      "#111111",
    );
  });

  it("stops on cycles and returns the unresolved var()", () => {
    const graph = new TokenGraph();
    graph.addToken(
      makeToken({
        cssVar: "--a",
        valueLight: "var(--b)",
        valueDark: "var(--b)",
      }),
    );
    graph.addToken(
      makeToken({
        cssVar: "--b",
        valueLight: "var(--a)",
        valueDark: "var(--a)",
      }),
    );

    expect(resolveToLiteral("var(--a)", graph, "light")).toBe("var(--a)");
  });

  it("returns literals unchanged", () => {
    expect(resolveToLiteral("#e95420", new TokenGraph(), "light")).toBe(
      "#e95420",
    );
  });

  it("returns unresolved references when the target is missing", () => {
    expect(resolveToLiteral("var(--missing)", new TokenGraph(), "light")).toBe(
      "var(--missing)",
    );
  });
});

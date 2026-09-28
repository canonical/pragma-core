import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeTokenNode as makeToken } from "../../testing/index.js";
import buildResolutionTable from "./buildResolutionTable.js";

describe("buildResolutionTable", () => {
  it("splits the terminal row when light and dark resolve differently", () => {
    const graph = new TokenGraph();
    const token = makeToken({
      cssVar: "--surface-color",
      aliasChain: ["--surface-light"],
      tier: "semantic",
      valueLight: "var(--surface-light)",
      valueDark: "var(--surface-dark)",
      isPaired: true,
    });

    graph.addToken(token);
    graph.addToken(
      makeToken({
        cssVar: "--surface-light",
        tier: "primitive",
        valueLight: "#ffffff",
        valueDark: "#ffffff",
      }),
    );
    graph.addToken(
      makeToken({
        cssVar: "--surface-dark",
        tier: "primitive",
        valueLight: "#111111",
        valueDark: "#111111",
      }),
    );

    const result = buildResolutionTable(token, graph);

    expect(result).toContain("| 1L |");
    expect(result).toContain("| 1D |");
    expect(result).toContain("--surface-dark");
    expect(result).toContain("#111111");
  });

  it("shows single-step terminal values", () => {
    const graph = new TokenGraph();
    const token = makeToken({
      cssVar: "--single-step-color",
      tier: "primitive",
      valueLight: "#abcdef",
      valueDark: "#abcdef",
    });

    graph.addToken(token);

    const result = buildResolutionTable(token, graph);

    expect(result).toContain("| 1 | `--single-step-color` | `#abcdef` |");
  });

  it("marks unresolved alias steps with a question mark", () => {
    const graph = new TokenGraph();
    const token = makeToken({
      cssVar: "--broken-color",
      aliasChain: ["--missing-color"],
      tier: "semantic",
      valueLight: "var(--missing-color)",
      valueDark: "var(--missing-color)",
    });

    graph.addToken(token);

    const result = buildResolutionTable(token, graph);

    expect(result).toContain("--missing-color");
    expect(result).toContain("`?`");
  });
});

import { describe, expect, it } from "vitest";
import { TokenGraph } from "../graph/index.js";
import {
  makeConfig,
  makeDeclarationNode,
  makePropertyNode,
  makeTokenNode,
} from "../testing/index.js";
import { buildTokenTooltip } from "./tokenTooltip/index.js";

function makeTooltipGraph(): TokenGraph {
  const graph = new TokenGraph();

  graph.addToken(
    makeTokenNode({
      cssVar: "--color-bg",
      id: "color.background",
      type: "color",
      description: "Page background colour",
      aliasChain: ["--color-brand-primary", "--color-palette-orange"],
      tier: "semantic",
      cssType: "<color>",
      valueLight: "var(--color-brand-primary)",
      valueDark: "var(--color-brand-primary)",
      sourceFile: "/project/tokens/color.tokens.json",
      sourceLine: 12,
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--color-brand-primary",
      id: "color.brand.primary",
      type: "color",
      aliasChain: ["--color-palette-orange"],
      tier: "semantic",
      cssType: "<color>",
      valueLight: "var(--color-palette-orange)",
      valueDark: "var(--color-palette-orange)",
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--color-palette-orange",
      id: "color.palette.orange",
      type: "color",
      tier: "primitive",
      cssType: "<color>",
      valueLight: "#e95420",
      valueDark: "#e95420",
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--surface-color",
      id: "surface.color",
      type: "color",
      aliasChain: ["--surface-light"],
      tier: "semantic",
      cssType: "<color>",
      valueLight: "var(--surface-light)",
      valueDark: "var(--surface-dark)",
      isPaired: true,
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--surface-light",
      id: "surface.light",
      type: "color",
      tier: "primitive",
      cssType: "<color>",
      valueLight: "#ffffff",
      valueDark: "#ffffff",
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--surface-dark",
      id: "surface.dark",
      type: "color",
      tier: "primitive",
      cssType: "<color>",
      valueLight: "#111111",
      valueDark: "#111111",
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--derived-color",
      id: "color.derived",
      type: "color",
      tier: "derived",
      cssType: "<color>",
      valueLight: "var(--color-bg)",
      valueDark: "var(--color-bg)",
      derivedFrom: "--color-bg",
      derivation: "hover",
    }),
  );
  graph.addToken(
    makeTokenNode({
      cssVar: "--single-step-color",
      id: "color.single",
      type: "color",
      tier: "primitive",
      cssType: "<color>",
      valueLight: "#abcdef",
      valueDark: "#abcdef",
    }),
  );

  graph.addDeclaration(
    makeDeclarationNode({
      cssVar: "--local-color",
      fileUri: "file:///project/src/button.css",
      line: 4,
      rawValue: "#0f0",
      selector: {
        selector: ".button",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    }),
  );

  graph.addFile({
    uri: "file:///project/node_modules/@acme/tokens/tokens.css",
    path: "/project/node_modules/@acme/tokens/tokens.css",
    isExternal: true,
    packageName: "@acme/tokens",
  });
  graph.addDeclaration(
    makeDeclarationNode({
      cssVar: "--external-color",
      fileUri: "file:///project/node_modules/@acme/tokens/tokens.css",
      line: 2,
      rawValue: "#123456",
    }),
  );

  graph.addProperty(
    makePropertyNode({
      cssVar: "--registered-color",
      fileUri: "file:///project/src/tokens.css",
      syntax: "<color>",
      inherits: true,
      initialValue: "canvastext",
      cssType: "<color>",
    }),
  );

  return graph;
}

describe("buildTokenTooltip", () => {
  it("returns null for unknown variables", () => {
    const graph = new TokenGraph();

    expect(
      buildTokenTooltip(
        "--missing",
        "file:///project/src/app.css",
        graph,
        makeConfig(),
        {
          showDescription: true,
          showMetadataFooter: true,
          showProvenanceBadge: true,
          showSelectorContext: true,
        },
      ),
    ).toBeNull();
  });

  it("builds the full artifact tooltip layout", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--color-bg",
      "file:///project/src/app.css",
      graph,
      makeConfig(),
      {
        showDescription: true,
        showMetadataFooter: true,
        showProvenanceBadge: true,
        showSelectorContext: true,
      },
    );

    expect(result).toContain("Semantic");
    expect(result).toContain("Page background colour");
    expect(result).toContain("| # | Token | Value |");
    expect(result).toContain("--color-brand-primary");
    expect(result).toContain("--color-palette-orange");
    expect(result).toContain("color.tokens.json:13");
  });

  it("builds a property-only tooltip when only an @property exists", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--registered-color",
      "file:///project/src/app.css",
      graph,
      makeConfig(),
      {
        showDescription: true,
        showMetadataFooter: true,
        showProvenanceBadge: true,
        showSelectorContext: true,
      },
    );

    expect(result).toContain("Registered property");
    expect(result).toContain("syntax: `<color>`");
    expect(result).toContain("inherits: true");
  });

  it("includes local declaration sites when selector context is enabled", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--local-color",
      "file:///project/src/button.css",
      graph,
      makeConfig(),
      {
        showDescription: true,
        showMetadataFooter: true,
        showProvenanceBadge: true,
        showSelectorContext: true,
      },
    );

    expect(result).toContain(".button");
    expect(result).toContain("button.css:5");
    expect(result).toContain("⚠");
  });

  it("omits the provenance line when badges are disabled", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--color-bg",
      "file:///project/src/app.css",
      graph,
      makeConfig(),
      {
        showDescription: true,
        showMetadataFooter: true,
        showProvenanceBadge: false,
        showSelectorContext: true,
      },
    );

    expect(result).not.toContain("Semantic");
    expect(result).toContain("Page background colour");
  });

  it("omits footer sections when metadata is disabled", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--color-bg",
      "file:///project/src/app.css",
      graph,
      makeConfig(),
      {
        showDescription: true,
        showMetadataFooter: false,
        showProvenanceBadge: true,
        showSelectorContext: true,
      },
    );

    expect(result).not.toContain("| # | Token | Value |");
    expect(result).not.toContain("color.tokens.json:13");
  });

  it("omits the description when descriptions are disabled", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--color-bg",
      "file:///project/src/app.css",
      graph,
      makeConfig(),
      {
        showDescription: false,
        showMetadataFooter: true,
        showProvenanceBadge: true,
        showSelectorContext: true,
      },
    );

    expect(result).not.toContain("Page background colour");
  });

  it("omits declaration sites when selector context is disabled", () => {
    const graph = makeTooltipGraph();

    const result = buildTokenTooltip(
      "--local-color",
      "file:///project/src/button.css",
      graph,
      makeConfig(),
      {
        showDescription: true,
        showMetadataFooter: true,
        showProvenanceBadge: true,
        showSelectorContext: false,
      },
    );

    expect(result).toContain("button.css:5");
    expect(result).not.toContain("| | Selector | Source |");
  });
});

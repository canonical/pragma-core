import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import {
  makeDeclarationNode as makeDeclaration,
  makePropertyNode as makeProperty,
  makeTokenNode as makeToken,
} from "../../testing/index.js";
import formatProvenanceLine from "./formatProvenanceLine.js";

describe("formatProvenanceLine", () => {
  it("formats artifact provenance with tier, type, and resolved value", () => {
    const graph = new TokenGraph();
    graph.addToken(
      makeToken({
        cssVar: "--color-bg",
        type: "color",
        aliasChain: ["--color-palette-orange"],
        tier: "semantic",
        valueLight: "var(--color-palette-orange)",
        valueDark: "var(--color-palette-orange)",
      }),
    );
    const token = makeToken({
      cssVar: "--color-palette-orange",
      type: "color",
      tier: "primitive",
      valueLight: "#e95420",
      valueDark: "#e95420",
    });
    graph.addToken(token);

    const result = formatProvenanceLine(
      { kind: "artifact", packageSource: "@canonical/tokens" },
      graph.resolveToken("--color-bg"),
      undefined,
      [],
      graph,
    );

    expect(result).toContain("Semantic");
    expect(result).toContain("`color`");
    expect(result).toContain("`#e95420`");
  });

  it("formats external provenance with a truncated value and package name", () => {
    const graph = new TokenGraph();
    const declarations = [
      makeDeclaration({
        cssVar: "--external-color",
        fileUri: "file:///project/node_modules/@acme/tokens/tokens.css",
        rawValue: "color-mix(in srgb, red 40%, blue 60%)",
      }),
    ];

    const result = formatProvenanceLine(
      { kind: "external", packageName: "@acme/tokens" },
      undefined,
      undefined,
      declarations,
      graph,
    );

    expect(result).toContain("@acme/tokens");
    expect(result).toContain("...");
  });

  it("formats local provenance with selector warnings", () => {
    const graph = new TokenGraph();
    const declarations = [
      makeDeclaration({
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
    ];

    const result = formatProvenanceLine(
      { kind: "local", fileUri: "file:///project/src/button.css" },
      undefined,
      undefined,
      declarations,
      graph,
    );

    expect(result).toContain(".button");
    expect(result).toContain("button.css:5");
    expect(result).toContain("⚠");
  });

  it("formats property provenance with syntax and initial value", () => {
    const graph = new TokenGraph();
    const property = makeProperty({
      cssVar: "--registered-color",
      fileUri: "file:///project/src/tokens.css",
      initialValue: "canvastext",
    });

    const result = formatProvenanceLine(
      { kind: "property", fileUri: property.fileUri },
      undefined,
      property,
      [],
      graph,
    );

    expect(result).toContain("Registered property");
    expect(result).toContain("<color>");
    expect(result).toContain("canvastext");
  });

  it("formats derived artifact provenance with derivation metadata", () => {
    const graph = new TokenGraph();
    const baseToken = makeToken({
      cssVar: "--color-bg",
      tier: "semantic",
      valueLight: "#e95420",
      valueDark: "#e95420",
    });
    const derivedToken = makeToken({
      cssVar: "--derived-color",
      tier: "derived",
      valueLight: "var(--color-bg)",
      valueDark: "var(--color-bg)",
      derivedFrom: "--color-bg",
      derivation: "hover",
    });
    graph.addToken(baseToken);
    graph.addToken(derivedToken);

    const result = formatProvenanceLine(
      { kind: "artifact", packageSource: "@canonical/tokens" },
      derivedToken,
      undefined,
      [],
      graph,
    );

    expect(result).toContain("Derived");
    expect(result).toContain("from `--color-bg`");
    expect(result).toContain("hover state");
  });
});

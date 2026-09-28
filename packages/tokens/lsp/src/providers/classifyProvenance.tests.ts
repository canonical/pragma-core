/**
 * Provenance classification tests — TDD red phase.
 *
 * Tests the classification of CSS custom properties into four
 * provenance kinds: artifact, property, local, external.
 *
 */
import { describe, expect, it } from "vitest";
import { TokenGraph } from "../graph/index.js";
import { makeTokenNode } from "../testing/index.js";
import type { FileNode, PropertyNode, TokenNode } from "../types/index.js";
import classifyProvenance from "./classifyProvenance.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraph(): TokenGraph {
  return new TokenGraph();
}

function addTokenNode(
  graph: TokenGraph,
  cssVar: string,
  provenance: TokenNode["provenance"],
): void {
  graph.addToken(makeTokenNode({ cssVar, provenance }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("classifyProvenance", () => {
  it("returns artifact provenance when token has artifact kind", () => {
    const graph = makeGraph();
    addTokenNode(graph, "--color-bg", {
      kind: "artifact",
      packageSource: "@canonical/tokens",
    });

    const result = classifyProvenance("--color-bg", graph, "file:///a.css");
    expect(result).toEqual({
      kind: "artifact",
      packageSource: "@canonical/tokens",
    });
  });

  it("returns property provenance when @property block exists", () => {
    const graph = makeGraph();
    const prop: PropertyNode = {
      cssVar: "--accent",
      fileUri: "file:///theme.css",
      line: 5,
      syntax: "<color>",
      inherits: true,
      initialValue: null,
      cssType: "<color>",
    };
    graph.addProperty(prop);

    const result = classifyProvenance("--accent", graph, "file:///button.css");
    expect(result).toEqual({
      kind: "property",
      fileUri: "file:///theme.css",
    });
  });

  it("returns external provenance for declarations in node_modules", () => {
    const graph = makeGraph();
    const externalUri = "file:///project/node_modules/@acme/ui/dist/tokens.css";
    const file: FileNode = {
      uri: externalUri,
      path: "/project/node_modules/@acme/ui/dist/tokens.css",
      isExternal: true,
      packageName: "@acme/ui",
    };
    graph.addFile(file);
    graph.addDeclaration({
      cssVar: "--acme-color",
      fileUri: externalUri,
      line: 1,
      column: 0,
      rawValue: "blue",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = classifyProvenance(
      "--acme-color",
      graph,
      "file:///project/src/app.css",
    );
    expect(result).toEqual({
      kind: "external",
      packageName: "@acme/ui",
    });
  });

  it("returns local provenance for non-external declarations", () => {
    const graph = makeGraph();
    const localUri = "file:///src/button.css";
    graph.addFile({
      uri: localUri,
      path: "/src/button.css",
      isExternal: false,
      packageName: null,
    });
    graph.addDeclaration({
      cssVar: "--button-color",
      fileUri: localUri,
      line: 3,
      column: 0,
      rawValue: "red",
      cssType: "<color>",
      selector: {
        selector: ".button",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      },
    });

    const result = classifyProvenance(
      "--button-color",
      graph,
      "file:///src/app.css",
    );
    expect(result).toEqual({
      kind: "local",
      fileUri: localUri,
    });
  });

  it("returns local provenance with context fileUri when no data exists (buffer-only)", () => {
    const graph = makeGraph();

    const result = classifyProvenance(
      "--unknown-var",
      graph,
      "file:///src/app.css",
    );
    expect(result).toEqual({
      kind: "local",
      fileUri: "file:///src/app.css",
    });
  });

  it("artifact provenance takes priority over @property", () => {
    const graph = makeGraph();
    addTokenNode(graph, "--color-bg", {
      kind: "artifact",
      packageSource: "@canonical/tokens",
    });
    graph.addProperty({
      cssVar: "--color-bg",
      fileUri: "file:///a.css",
      line: 0,
      syntax: "<color>",
      inherits: true,
      initialValue: null,
      cssType: "<color>",
    });

    const result = classifyProvenance("--color-bg", graph, "file:///b.css");
    expect(result.kind).toBe("artifact");
  });

  it("@property provenance takes priority over local declaration", () => {
    const graph = makeGraph();
    graph.addProperty({
      cssVar: "--accent",
      fileUri: "file:///theme.css",
      line: 5,
      syntax: "<color>",
      inherits: true,
      initialValue: null,
      cssType: "<color>",
    });
    graph.addDeclaration({
      cssVar: "--accent",
      fileUri: "file:///local.css",
      line: 1,
      column: 0,
      rawValue: "green",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });

    const result = classifyProvenance("--accent", graph, "file:///app.css");
    expect(result.kind).toBe("property");
  });
});

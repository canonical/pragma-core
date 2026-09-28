/**
 * TokenGraph unit tests — TDD red phase.
 *
 * Tests the central graph data structure: construction, node registration,
 * query methods, and per-file invalidation.
 *
 */
import { describe, expect, it } from "vitest";
import {
  makeDeclarationNode,
  makePropertyNode,
  makeTokenNode,
} from "../testing/index.js";
import type { FileNode, SelectorContext, UsageNode } from "../types/index.js";
import TokenGraph from "./TokenGraph.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUsageNode(
  overrides: Partial<UsageNode> & { cssVar: string; fileUri: string },
): UsageNode {
  return {
    line: 0,
    column: 0,
    varNameColumn: 4,
    varNameLength: overrides.cssVar.length,
    property: "color",
    fallback: null,
    ...overrides,
  };
}

function makeFileNode(
  overrides: Partial<FileNode> & { uri: string },
): FileNode {
  return {
    path: overrides.uri.replace("file://", ""),
    isExternal: false,
    packageName: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TokenGraph", () => {
  describe("construction", () => {
    it("creates an empty graph", () => {
      const graph = new TokenGraph();
      expect(graph.tokenCount).toBe(0);
      expect(graph.fileCount).toBe(0);
      expect(graph.declarationVarCount).toBe(0);
      expect(graph.propertyVarCount).toBe(0);
      expect(graph.usageVarCount).toBe(0);
      expect(graph.varCount).toBe(0);
    });
  });

  describe("addToken", () => {
    it("adds a token and registers in allVars", () => {
      const graph = new TokenGraph();
      const node = makeTokenNode({ cssVar: "--color-bg" });
      graph.addToken(node);

      expect(graph.resolveToken("--color-bg")).toBe(node);
      expect(graph.hasVar("--color-bg")).toBe(true);
    });

    it("overwrites an existing token with the same cssVar", () => {
      const graph = new TokenGraph();
      const first = makeTokenNode({
        cssVar: "--x",
        description: "first",
      });
      const second = makeTokenNode({
        cssVar: "--x",
        description: "second",
      });
      graph.addToken(first);
      graph.addToken(second);

      expect(graph.resolveToken("--x")?.description).toBe("second");
    });
  });

  describe("addFile", () => {
    it("adds a file node", () => {
      const graph = new TokenGraph();
      const file = makeFileNode({ uri: "file:///src/a.css" });
      graph.addFile(file);

      expect(graph.getFile("file:///src/a.css")).toBe(file);
    });
  });

  describe("addDeclaration", () => {
    it("adds a declaration and registers in allVars and per-file index", () => {
      const graph = new TokenGraph();
      const decl = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///a.css",
      });
      graph.addDeclaration(decl);

      expect(graph.getDeclarations("--x")).toEqual([decl]);
      expect(graph.getDeclarationsByFile("file:///a.css")).toEqual([decl]);
      expect(graph.hasVar("--x")).toBe(true);
    });

    it("appends to existing declarations for the same cssVar", () => {
      const graph = new TokenGraph();
      const d1 = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///a.css",
        line: 1,
      });
      const d2 = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///b.css",
        line: 5,
      });
      graph.addDeclaration(d1);
      graph.addDeclaration(d2);

      expect(graph.getDeclarations("--x")).toEqual([d1, d2]);
    });
  });

  describe("addProperty", () => {
    it("adds an @property node and registers in allVars and per-file index", () => {
      const graph = new TokenGraph();
      const prop = makePropertyNode({
        cssVar: "--accent",
        fileUri: "file:///theme.css",
      });
      graph.addProperty(prop);

      expect(graph.getProperty("--accent")).toBe(prop);
      expect(graph.getPropertiesByFile("file:///theme.css")).toEqual([prop]);
      expect(graph.hasVar("--accent")).toBe(true);
    });
  });

  describe("addUsage", () => {
    it("adds a usage node and registers in per-file index", () => {
      const graph = new TokenGraph();
      const usage = makeUsageNode({
        cssVar: "--color-bg",
        fileUri: "file:///button.css",
      });
      graph.addUsage(usage);

      expect(graph.getUsages("--color-bg")).toEqual([usage]);
      expect(graph.getUsagesByFile("file:///button.css")).toEqual([usage]);
    });
  });

  describe("addImport", () => {
    it("adds a bidirectional import edge", () => {
      const graph = new TokenGraph();
      graph.addImport("file:///a.css", "file:///b.css");

      expect(graph.getImports("file:///a.css")?.has("file:///b.css")).toBe(
        true,
      );
      expect(graph.getImportedBy("file:///b.css")?.has("file:///a.css")).toBe(
        true,
      );
    });
  });

  describe("resolveToken", () => {
    it("returns a TokenNode for an existing cssVar", () => {
      const graph = new TokenGraph();
      const node = makeTokenNode({
        cssVar: "--color-bg",
        provenance: { kind: "artifact", packageSource: "@acme/tokens" },
      });
      graph.addToken(node);

      expect(graph.resolveToken("--color-bg")).toBe(node);
    });

    it("returns null for an unknown cssVar", () => {
      const graph = new TokenGraph();
      expect(graph.resolveToken("--nope")).toBeNull();
    });
  });

  describe("getDeclarations", () => {
    it("returns declarations for a known cssVar", () => {
      const graph = new TokenGraph();
      const d = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///a.css",
      });
      graph.addDeclaration(d);
      expect(graph.getDeclarations("--x")).toEqual([d]);
    });

    it("returns an empty array for an unknown cssVar", () => {
      const graph = new TokenGraph();
      expect(graph.getDeclarations("--nope")).toEqual([]);
    });
  });

  describe("selectorContextFor", () => {
    it("returns the selector context from the declaration node", () => {
      const graph = new TokenGraph();
      const selector: SelectorContext = {
        selector: ".button",
        atRules: [],
        scopeType: "class",
        isGlobal: false,
        isScoped: true,
      };
      const d = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///a.css",
        selector,
      });

      expect(graph.selectorContextFor(d)).toBe(selector);
    });
  });

  describe("clearFile", () => {
    it("removes all declarations, properties, and usages for a file URI", () => {
      const graph = new TokenGraph();
      const uri = "file:///a.css";

      graph.addDeclaration(
        makeDeclarationNode({ cssVar: "--x", fileUri: uri }),
      );
      graph.addDeclaration(
        makeDeclarationNode({ cssVar: "--y", fileUri: uri }),
      );
      graph.addProperty(makePropertyNode({ cssVar: "--z", fileUri: uri }));
      graph.addUsage(makeUsageNode({ cssVar: "--x", fileUri: uri }));

      graph.clearFile(uri);

      expect(graph.getDeclarationsByFile(uri)).toEqual([]);
      expect(graph.getPropertiesByFile(uri)).toEqual([]);
      expect(graph.getUsagesByFile(uri)).toEqual([]);
      // The declarations should be removed from the per-var index too
      expect(graph.getDeclarations("--x")).toEqual([]);
      expect(graph.getDeclarations("--y")).toEqual([]);
    });

    it("does not remove declarations from other files", () => {
      const graph = new TokenGraph();
      const d1 = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///a.css",
      });
      const d2 = makeDeclarationNode({
        cssVar: "--x",
        fileUri: "file:///b.css",
      });
      graph.addDeclaration(d1);
      graph.addDeclaration(d2);

      graph.clearFile("file:///a.css");

      expect(graph.getDeclarations("--x")).toEqual([d2]);
    });

    it("removes file-only variables from allVars", () => {
      const graph = new TokenGraph();

      graph.addDeclaration(
        makeDeclarationNode({ cssVar: "--x", fileUri: "file:///a.css" }),
      );

      expect(graph.hasVar("--x")).toBe(true);

      graph.clearFile("file:///a.css");

      expect(graph.hasVar("--x")).toBe(false);
    });
  });
});

/**
 * ReachabilityCache tests — TDD red phase.
 *
 * Tests import graph BFS traversal, cache hits/misses, invalidation
 * on @import changes, and globalStylesheets handling.
 *
 */
import { describe, expect, it } from "vitest";
import ReachabilityCache from "./ReachabilityCache.js";
import TokenGraph from "./TokenGraph.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraphWithImports(edges: Array<[string, string]>): TokenGraph {
  const graph = new TokenGraph();
  for (const [from, to] of edges) {
    graph.addImport(from, to);
  }
  return graph;
}

function addDeclaration(
  graph: TokenGraph,
  cssVar: string,
  fileUri: string,
): void {
  graph.addDeclaration({
    cssVar,
    fileUri,
    line: 0,
    column: 0,
    rawValue: "red",
    cssType: "<color>",
    selector: {
      selector: ":root",
      atRules: [],
      scopeType: "global",
      isGlobal: true,
      isScoped: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReachabilityCache", () => {
  describe("reachableFiles", () => {
    it("returns the file itself when it has no imports", () => {
      const graph = makeGraphWithImports([]);
      const cache = new ReachabilityCache();

      const result = cache.getReachableFiles("file:///a.css", graph);
      expect(result).toEqual(new Set(["file:///a.css"]));
    });

    it("follows direct imports", () => {
      const graph = makeGraphWithImports([["file:///a.css", "file:///b.css"]]);
      const cache = new ReachabilityCache();

      const result = cache.getReachableFiles("file:///a.css", graph);
      expect(result).toContain("file:///a.css");
      expect(result).toContain("file:///b.css");
    });

    it("follows transitive imports", () => {
      const graph = makeGraphWithImports([
        ["file:///a.css", "file:///b.css"],
        ["file:///b.css", "file:///c.css"],
      ]);
      const cache = new ReachabilityCache();

      const result = cache.getReachableFiles("file:///a.css", graph);
      expect(result).toContain("file:///c.css");
    });

    it("handles circular imports without infinite loop", () => {
      const graph = makeGraphWithImports([
        ["file:///a.css", "file:///b.css"],
        ["file:///b.css", "file:///a.css"],
      ]);
      const cache = new ReachabilityCache();

      const result = cache.getReachableFiles("file:///a.css", graph);
      expect(result.size).toBe(2);
    });

    it("handles diamond imports", () => {
      const graph = makeGraphWithImports([
        ["file:///a.css", "file:///b.css"],
        ["file:///a.css", "file:///c.css"],
        ["file:///b.css", "file:///d.css"],
        ["file:///c.css", "file:///d.css"],
      ]);
      const cache = new ReachabilityCache();

      const result = cache.getReachableFiles("file:///a.css", graph);
      expect(result.size).toBe(4);
    });
  });

  describe("cache hits", () => {
    it("returns cached result on second call", () => {
      const graph = makeGraphWithImports([["file:///a.css", "file:///b.css"]]);
      const cache = new ReachabilityCache();

      const first = cache.getReachableFiles("file:///a.css", graph);
      const second = cache.getReachableFiles("file:///a.css", graph);
      // Same reference
      expect(second).toBe(first);
    });
  });

  describe("invalidation", () => {
    it("invalidates when a file's imports change", () => {
      const graph = makeGraphWithImports([["file:///a.css", "file:///b.css"]]);
      const cache = new ReachabilityCache();

      const before = cache.getReachableFiles("file:///a.css", graph);
      expect(before).toContain("file:///b.css");

      cache.invalidate("file:///a.css");

      // Remove the import edge in graph and re-query
      graph.setImports("file:///a.css", new Set());
      const after = cache.getReachableFiles("file:///a.css", graph);
      expect(after).not.toContain("file:///b.css");
    });

    it("invalidateAll clears the entire cache", () => {
      const graph = makeGraphWithImports([["file:///a.css", "file:///b.css"]]);
      const cache = new ReachabilityCache();
      cache.getReachableFiles("file:///a.css", graph);

      cache.invalidateAll();

      // After invalidateAll, next call should recompute
      graph.setImports("file:///a.css", new Set());
      const after = cache.getReachableFiles("file:///a.css", graph);
      expect(after).not.toContain("file:///b.css");
    });
  });

  describe("reachableVars", () => {
    it("returns cssVars declared in reachable files", () => {
      const graph = makeGraphWithImports([["file:///a.css", "file:///b.css"]]);
      addDeclaration(graph, "--x", "file:///a.css");
      addDeclaration(graph, "--y", "file:///b.css");

      const cache = new ReachabilityCache();
      const vars = cache.getReachableVars("file:///a.css", graph);
      expect(vars).toContain("--x");
      expect(vars).toContain("--y");
    });

    it("excludes vars from unreachable files", () => {
      const graph = makeGraphWithImports([["file:///a.css", "file:///b.css"]]);
      addDeclaration(graph, "--x", "file:///a.css");
      addDeclaration(graph, "--y", "file:///b.css");
      addDeclaration(graph, "--z", "file:///c.css");

      const cache = new ReachabilityCache();
      const vars = cache.getReachableVars("file:///a.css", graph);
      expect(vars).not.toContain("--z");
    });
  });

  describe("globalStylesheets", () => {
    it("includes vars from global stylesheets regardless of imports", () => {
      const graph = makeGraphWithImports([]);
      addDeclaration(graph, "--token-x", "file:///dist/tokens.css");

      const cache = new ReachabilityCache();
      const globals = new Set(["file:///dist/tokens.css"]);
      const vars = cache.getReachableVars(
        "file:///src/button.css",
        graph,
        globals,
      );
      expect(vars).toContain("--token-x");
    });

    it("does not include global vars when globalStylesheets is empty set", () => {
      const graph = makeGraphWithImports([]);
      addDeclaration(graph, "--token-x", "file:///dist/tokens.css");

      const cache = new ReachabilityCache();
      const vars = cache.getReachableVars(
        "file:///src/button.css",
        graph,
        new Set(),
      );
      expect(vars).not.toContain("--token-x");
    });
  });

  describe("LRU eviction", () => {
    it("evicts the oldest entry when cache exceeds 500 entries", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();

      // Fill the cache with 500 entries
      for (let i = 0; i < 500; i++) {
        const uri = `file:///file-${i}.css`;
        cache.getReachableFiles(uri, graph);
      }

      expect(cache.size).toBe(500);

      // Adding one more should evict the oldest (file-0)
      cache.getReachableFiles("file:///file-500.css", graph);
      expect(cache.size).toBe(500);

      // The first entry should have been evicted and recomputed on access
      const result = cache.getReachableFiles("file:///file-0.css", graph);
      expect(result).toContain("file:///file-0.css");
    });

    it("refreshes a cached entry on access (LRU ordering)", () => {
      const graph = new TokenGraph();
      const cache = new ReachabilityCache();

      // Fill cache
      for (let i = 0; i < 500; i++) {
        cache.getReachableFiles(`file:///file-${i}.css`, graph);
      }

      // Access file-0 to refresh it (move to end)
      cache.getReachableFiles("file:///file-0.css", graph);

      // Adding a new entry should evict file-1 (now oldest), not file-0
      cache.getReachableFiles("file:///file-new.css", graph);
      expect(cache.size).toBe(500);
    });
  });
});

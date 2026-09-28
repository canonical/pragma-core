/**
 * Import graph BFS driver tests — TDD.
 *
 * Tests the async BFS traversal that reads files from disk,
 * extracts imports, and populates the TokenGraph.
 *
 */
import { describe, expect, it } from "vitest";
import { TokenGraph } from "../graph/index.js";
import buildImportGraph from "./buildImportGraph.js";
import type { FileSystem } from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFs(
  files: Record<string, string>,
  rootDir = "/project",
): FileSystem {
  return {
    rootDir,
    async readFile(uri: string): Promise<string | null> {
      const path = uri.startsWith("file://") ? uri.slice(7) : uri;
      return files[path] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildImportGraph", () => {
  it("scans declarations from the root file", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `:root { --color-bg: #fff; }`,
    });

    await buildImportGraph("file:///project/src/a.css", graph, fs);

    const decls = graph.getDeclarationsByFile("file:///project/src/a.css");
    expect(decls).toBeDefined();
    expect(decls?.length).toBeGreaterThan(0);
    expect(decls?.[0]?.cssVar).toBe("--color-bg");
  });

  it("follows @import edges and adds import relationships", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `@import "./b.css";\n.box { color: var(--x); }`,
      "/project/src/b.css": `:root { --x: red; }`,
    });

    await buildImportGraph("file:///project/src/a.css", graph, fs);

    // Import edge exists
    const imports = graph.getImports("file:///project/src/a.css");
    expect(imports).toBeDefined();
    expect(imports?.size).toBeGreaterThan(0);

    // Declarations from b.css are scanned
    expect(graph.hasVar("--x")).toBe(true);
  });

  it("handles circular imports without infinite loop", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `@import "./b.css";\n:root { --a: 1; }`,
      "/project/src/b.css": `@import "./a.css";\n:root { --b: 2; }`,
    });

    // Should not hang
    await buildImportGraph("file:///project/src/a.css", graph, fs);

    expect(graph.hasVar("--a")).toBe(true);
    expect(graph.hasVar("--b")).toBe(true);
  });

  it("creates FileNode entries for all visited files", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `@import "./b.css";`,
      "/project/src/b.css": `:root { --x: 1; }`,
    });

    await buildImportGraph("file:///project/src/a.css", graph, fs);

    expect(graph.hasFile("file:///project/src/a.css")).toBe(true);
    expect(graph.hasFile("file:///project/src/b.css")).toBe(true);
  });

  it("skips files that do not exist", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `@import "./missing.css";`,
    });

    await buildImportGraph("file:///project/src/a.css", graph, fs);

    // Should not throw, missing.css is simply skipped
    expect(graph.hasFile("file:///project/src/a.css")).toBe(true);
  });

  it("scans @property blocks from imported files", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `@import "./tokens.css";`,
      "/project/src/tokens.css": `@property --color-bg {\n  syntax: "<color>";\n  inherits: true;\n  initial-value: white;\n}`,
    });

    await buildImportGraph("file:///project/src/a.css", graph, fs);

    const prop = graph.getProperty("--color-bg");
    expect(prop).toBeDefined();
    expect(prop?.syntax).toBe("<color>");
  });

  it("scans usages from all visited files", async () => {
    const graph = new TokenGraph();
    const fs = makeFs({
      "/project/src/a.css": `.box { color: var(--color-fg); }`,
    });

    await buildImportGraph("file:///project/src/a.css", graph, fs);

    const usages = graph.getUsagesByFile("file:///project/src/a.css");
    expect(usages).toBeDefined();
    expect(usages?.some((u) => u.cssVar === "--color-fg")).toBe(true);
  });
});

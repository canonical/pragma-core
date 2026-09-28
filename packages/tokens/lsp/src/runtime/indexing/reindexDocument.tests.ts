import { describe, expect, it } from "vitest";
import { parseCSS } from "../../css/lezer/index.js";
import { ReachabilityCache, TokenGraph } from "../../graph/index.js";
import type { FileSystem } from "../types.js";
import reindexDocument from "./reindexDocument.js";

describe("reindexDocument", () => {
  it("rebuilds indexed CSS state and clears stale imported data", async () => {
    const cache = new ReachabilityCache();
    const graph = new TokenGraph();
    const rootUri = "file:///project/src/app.css";
    const importedUri = "file:///project/src/tokens.css";
    const fs: FileSystem = {
      rootDir: "/project",
      async readFile(uri: string): Promise<string | null> {
        if (uri === importedUri) {
          return ":root { --brand-alt: #77216f; }";
        }
        return null;
      },
    };
    const source = '@import "./tokens.css";\n:root { --local-color: #e95420; }';

    graph.addFile({
      uri: rootUri,
      path: "/project/src/app.css",
      isExternal: false,
      packageName: null,
    });
    graph.addFile({
      uri: importedUri,
      path: "/project/src/tokens.css",
      isExternal: false,
      packageName: null,
    });
    graph.addImport(rootUri, importedUri);
    graph.addDeclaration({
      cssVar: "--brand-color",
      fileUri: importedUri,
      line: 0,
      column: 0,
      rawValue: "#e95420",
      cssType: "<color>",
      selector: {
        selector: ":root",
        atRules: [],
        scopeType: "global",
        isGlobal: true,
        isScoped: false,
      },
    });
    cache.getReachableFiles(rootUri, graph);

    await reindexDocument({
      cache,
      fs,
      graph,
      invalidateUri: rootUri,
      openDocuments: new Map([[rootUri, source]]),
      openTrees: new Map([[rootUri, parseCSS(source)]]),
    });

    expect(graph.hasVar("--brand-color")).toBe(false);
    expect(
      graph.getDeclarationsByFile(importedUri).map((item) => item.cssVar),
    ).toEqual(["--brand-alt"]);
    expect(
      graph.getDeclarationsByFile(rootUri).map((item) => item.cssVar),
    ).toEqual(["--local-color"]);
    expect(cache.getReachableFiles(rootUri, graph)).toEqual(
      new Set([rootUri, importedUri]),
    );
  });
});

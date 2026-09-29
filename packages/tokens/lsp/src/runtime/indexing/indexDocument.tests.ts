import { describe, expect, it } from "vitest";
import { parseCSS } from "../../css/lezer/index.js";
import { TokenGraph } from "../../graph/index.js";
import indexDocument from "./indexDocument.js";

describe("indexDocument", () => {
  it("indexes a document and updates its import edges", () => {
    const graph = new TokenGraph();
    const fileUri = "file:///project/src/app.css";

    indexDocument({
      fileUri,
      graph,
      rootDir: "/project",
      source: ":root { --old-var: red; }",
      tree: parseCSS(":root { --old-var: red; }"),
    });

    const importedUris = indexDocument({
      fileUri,
      graph,
      rootDir: "/project",
      source:
        '@import "./tokens.css";\n:root { --new-var: #e95420; }\n.button { color: var(--new-var); }',
      tree: parseCSS(
        '@import "./tokens.css";\n:root { --new-var: #e95420; }\n.button { color: var(--new-var); }',
      ),
    });

    expect(importedUris).toEqual(["file:///project/src/tokens.css"]);
    expect(graph.hasVar("--old-var")).toBe(false);
    expect(
      graph.getDeclarationsByFile(fileUri).map((item) => item.cssVar),
    ).toEqual(["--new-var"]);
    expect(graph.getUsagesByFile(fileUri).map((item) => item.cssVar)).toEqual([
      "--new-var",
    ]);
    expect(graph.getImports(fileUri)).toEqual(
      new Set(["file:///project/src/tokens.css"]),
    );
  });
});

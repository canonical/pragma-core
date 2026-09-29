import { describe, expect, it } from "vitest";
import createDocumentIndex from "./createDocumentIndex.js";
import { parseCSS } from "./lezer/index.js";

describe("createDocumentIndex", () => {
  it("builds a document index including imports, declarations, and usages", () => {
    const source =
      '@import "./tokens.css";\n:root { --local-color: #e95420; }\n.button { color: var(--local-color); }';
    const fileUri = "file:///project/src/app.css";

    const index = createDocumentIndex({
      fileUri,
      rootDir: "/project",
      source,
      tree: parseCSS(source),
    });

    expect(index.file).toEqual({
      uri: fileUri,
      path: "/project/src/app.css",
      isExternal: false,
      packageName: null,
    });
    expect(index.importedUris).toEqual(["file:///project/src/tokens.css"]);
    expect(index.declarations.map((declaration) => declaration.cssVar)).toEqual(
      ["--local-color"],
    );
    expect(index.usages.map((usage) => usage.cssVar)).toEqual([
      "--local-color",
    ]);
  });

  it("skips import resolution when no rootDir is provided", () => {
    const source = '@import "./tokens.css";';

    const index = createDocumentIndex({
      fileUri: "file:///project/src/app.css",
      source,
      tree: parseCSS(source),
    });

    expect(index.importedUris).toEqual([]);
  });
});

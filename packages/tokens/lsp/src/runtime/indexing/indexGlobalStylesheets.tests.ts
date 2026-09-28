import { describe, expect, it } from "vitest";
import { parseCSS } from "../../css/lezer/index.js";
import { TokenGraph } from "../../graph/index.js";
import type { FileSystem } from "../types.js";
import indexGlobalStylesheets from "./indexGlobalStylesheets.js";

describe("indexGlobalStylesheets", () => {
  it("indexes both configured global stylesheets and open documents", async () => {
    const graph = new TokenGraph();
    const openUri = "file:///project/src/app.css";
    const globalUri = "file:///project/src/global.css";
    const fs: FileSystem = {
      rootDir: "/project",
      async readFile(uri: string): Promise<string | null> {
        if (uri === globalUri) {
          return ":root { --global-color: #111111; }";
        }
        return null;
      },
    };
    const openSource = ":root { --open-color: #e95420; }";

    await indexGlobalStylesheets({
      fs,
      globalStylesheets: [globalUri],
      graph,
      openDocuments: new Map([[openUri, openSource]]),
      openTrees: new Map([[openUri, parseCSS(openSource)]]),
    });

    expect(
      graph.getDeclarationsByFile(openUri).map((item) => item.cssVar),
    ).toEqual(["--open-color"]);
    expect(
      graph.getDeclarationsByFile(globalUri).map((item) => item.cssVar),
    ).toEqual(["--global-color"]);
  });
});

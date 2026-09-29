import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import updateImportEdges from "./updateImportEdges.js";

describe("updateImportEdges", () => {
  it("replaces stale edges and preserves reverse links", () => {
    const graph = new TokenGraph();
    graph.addImport("file:///project/app.css", "file:///project/old.css");
    graph.addImport("file:///project/other.css", "file:///project/shared.css");

    updateImportEdges({
      graph,
      importedUris: ["file:///project/new.css", "file:///project/shared.css"],
      importerUri: "file:///project/app.css",
    });

    expect(graph.getImports("file:///project/app.css")).toEqual(
      new Set(["file:///project/new.css", "file:///project/shared.css"]),
    );
    expect(graph.getImportedBy("file:///project/old.css")).toBeUndefined();
    expect(graph.getImportedBy("file:///project/new.css")).toEqual(
      new Set(["file:///project/app.css"]),
    );
    expect(graph.getImportedBy("file:///project/shared.css")).toEqual(
      new Set(["file:///project/other.css", "file:///project/app.css"]),
    );
  });

  it("removes the importer entry when no imports remain", () => {
    const graph = new TokenGraph();
    graph.addImport("file:///project/app.css", "file:///project/old.css");

    updateImportEdges({
      graph,
      importedUris: [],
      importerUri: "file:///project/app.css",
    });

    expect(graph.getImports("file:///project/app.css")).toBeUndefined();
    expect(graph.getImportedBy("file:///project/old.css")).toBeUndefined();
  });
});

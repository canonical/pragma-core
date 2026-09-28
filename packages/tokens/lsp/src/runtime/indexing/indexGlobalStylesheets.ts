/**
 * Index configured global stylesheets and open document roots.
 */
import type { Tree } from "../../css/lezer/index.js";
import type { TokenGraph } from "../../graph/index.js";
import buildImportGraph from "../buildImportGraph.js";
import type { FileSystem } from "../types.js";

interface IndexGlobalStylesheetsOptions {
  fs: FileSystem;
  globalStylesheets?: readonly string[];
  graph: TokenGraph;
  openDocuments: ReadonlyMap<string, string>;
  openTrees: ReadonlyMap<string, Tree>;
}

export default async function indexGlobalStylesheets(
  options: IndexGlobalStylesheetsOptions,
): Promise<void> {
  const {
    fs,
    globalStylesheets = [],
    graph,
    openDocuments,
    openTrees,
  } = options;
  const rootUris = new Set<string>(globalStylesheets);

  for (const openDocumentUri of openDocuments.keys()) {
    rootUris.add(openDocumentUri);
  }

  for (const rootUri of rootUris) {
    await buildImportGraph(rootUri, graph, fs, openDocuments, openTrees);
  }
}

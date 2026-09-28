/**
 * Rebuild the indexed CSS graph for all active roots.
 */
import type { Tree } from "../../css/lezer/index.js";
import type { ReachabilityCache, TokenGraph } from "../../graph/index.js";
import type { FileSystem } from "../types.js";
import indexGlobalStylesheets from "./indexGlobalStylesheets.js";

interface ReindexDocumentOptions {
  cache: ReachabilityCache;
  fs: FileSystem;
  globalStylesheets?: readonly string[];
  graph: TokenGraph;
  invalidateUri?: string;
  openDocuments: ReadonlyMap<string, string>;
  openTrees: ReadonlyMap<string, Tree>;
}

export default async function reindexDocument(
  options: ReindexDocumentOptions,
): Promise<void> {
  const {
    cache,
    fs,
    globalStylesheets,
    graph,
    invalidateUri,
    openDocuments,
    openTrees,
  } = options;

  graph.clearCssData();
  await indexGlobalStylesheets({
    fs,
    globalStylesheets,
    graph,
    openDocuments,
    openTrees,
  });

  if (invalidateUri) {
    cache.invalidate(invalidateUri);
  }
}

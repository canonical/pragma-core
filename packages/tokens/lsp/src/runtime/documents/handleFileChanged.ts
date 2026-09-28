import type { WorkerRequest } from "../../types/index.js";
import reindexDocument from "../indexing/reindexDocument.js";
import type { ServerState } from "../types.js";

/** @note impure: mutates server caches by reindexing the changed document. */
export default async function handleFileChanged(
  state: ServerState,
  request: Extract<WorkerRequest, { type: "FILE_CHANGED" }>,
): Promise<void> {
  await reindexDocument({
    cache: state.cache,
    fs: state.fs,
    globalStylesheets: state.config.globalStylesheets ?? undefined,
    graph: state.graph,
    invalidateUri: request.uri,
    openDocuments: state.openDocuments,
    openTrees: state.openTrees,
  });
}

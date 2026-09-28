/**
 * Handle textDocument/didClose — clean up open document state.
 *
 * @note impure — mutates ServerState, clears pending timers.
 */
import type { WorkerRequest } from "../../types/index.js";
import type { ServerState } from "../types.js";

export default function handleCloseDocument(
  state: ServerState,
  request: Extract<WorkerRequest, { type: "CLOSE_DOC" }>,
): void {
  state.openDocuments.delete(request.uri);
  state.openTrees.delete(request.uri);
  // Drop the revision counter so a diagnostics pass still in flight for this
  // document bails out after its await instead of publishing for a closed doc
  // (and so the map does not grow unbounded across open/close cycles).
  state.docVersions.delete(request.uri);
  const pendingUpdate = state.pendingUpdates.get(request.uri);
  if (!pendingUpdate) return;
  clearTimeout(pendingUpdate.timer);
  state.pendingUpdates.delete(request.uri);
}

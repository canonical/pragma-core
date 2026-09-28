import { produceArtifactDiagnostics } from "../../providers/index.js";
import type { WorkerRequest } from "../../types/index.js";
import { loadConfiguredArtifacts } from "../artifacts/index.js";
import type { ServerState } from "../types.js";

/** @note impure: clears graph state, reloads artifacts, and may post diagnostics. */
export default async function handleArtifactChanged(
  state: ServerState,
  request: Extract<WorkerRequest, { type: "ARTIFACT_CHANGED" }>,
): Promise<void> {
  state.cache.invalidateAll();
  state.graph.clearTokens();
  await loadConfiguredArtifacts(state);
  const diagnostics = produceArtifactDiagnostics(state.graph, state.config);
  // Always publish, including an empty array. LSP diagnostics persist until
  // they are replaced, so returning early on zero would leave the editor
  // showing the errors of a rebuild that has since fixed them.
  state.postMessage({
    id: request.id,
    type: "PUSH_DIAGNOSTICS",
    uri: request.uri,
    diagnostics,
  });
}

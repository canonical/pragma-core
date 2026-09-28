/**
 * Buffer layer — debounced re-scan for a single file.
 *
 * After a document change, we delay the re-scan by 100ms. If another
 * change arrives within that window, the previous timer is cleared.
 *
 * @note This function is impure — it uses `setTimeout` side effects.
 *
 */
import type { Tree } from "../css/lezer/index.js";
import * as lezer from "../css/lezer/index.js";
import type { ReachabilityCache, TokenGraph } from "../graph/index.js";
import indexDocument from "./indexing/indexDocument.js";
import type { PendingUpdate } from "./types.js";

const DEBOUNCE_MS = 20;

/**
 * Schedule a debounced buffer update for a file.
 *
 * Clears any pending update for the same URI, then re-scans after 100ms.
 *
 * @note This function is impure — it schedules timers and mutates the graph.
 */
export function scheduleBufferUpdate(
  uri: string,
  source: string,
  graph: TokenGraph,
  cache: ReachabilityCache,
  pending: Map<string, PendingUpdate>,
  onComplete?: () => void,
  tree?: Tree,
): void {
  const existing = pending.get(uri);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(uri);
  }

  const timer = setTimeout(() => {
    pending.delete(uri);
    rescanFile(uri, source, graph, tree);
    cache.invalidate(uri);
    onComplete?.();
  }, DEBOUNCE_MS);

  pending.set(uri, { timer, uri });
}

/**
 * Immediately rescan a file and update the graph.
 *
 * @note This function is impure — it mutates the graph.
 */
export function rescanFile(
  uri: string,
  source: string,
  graph: TokenGraph,
  tree?: Tree,
): void {
  const parsed = tree ?? lezer.parseCSS(source);
  indexDocument({
    fileUri: uri,
    graph,
    source,
    tree: parsed,
  });
}

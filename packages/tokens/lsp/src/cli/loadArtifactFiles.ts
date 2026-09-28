/**
 * Read JSON artifact files from disk and load them into the token graph.
 *
 * @note Impure — reads files from disk.
 */
import * as fs from "node:fs/promises";
import { dirname } from "node:path";
import { loadArtifact, type TokenGraph } from "../graph/index.js";
import type { RawArtifact } from "../types/index.js";

export async function loadArtifactFiles(
  paths: string[],
  graph: TokenGraph,
): Promise<void> {
  for (const p of paths) {
    try {
      const raw = await fs.readFile(p, "utf-8");
      const artifact: RawArtifact = JSON.parse(raw);
      loadArtifact(artifact, graph, "", dirname(p));
    } catch {
      // Skip missing artifacts
    }
  }
}

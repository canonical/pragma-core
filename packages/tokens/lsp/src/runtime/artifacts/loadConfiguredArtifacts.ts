/**
 * @note impure — reads artifact JSON files from disk.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadArtifact } from "../../graph/index.js";
import type { RawArtifact } from "../../types/index.js";
import type { ServerState } from "../types.js";

export default async function loadConfiguredArtifacts(
  state: ServerState,
): Promise<void> {
  for (const artifactPath of state.config.artifactPaths) {
    try {
      const raw = await fs.readFile(artifactPath, "utf-8");
      const artifact: RawArtifact = JSON.parse(raw);
      const packageSource = derivePackageSource(artifactPath);
      const artifactDir = path.dirname(artifactPath);
      loadArtifact(artifact, state.graph, packageSource, artifactDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      state.log(`Failed to load artifact: ${artifactPath} — ${detail}`);
    }
  }
}

function derivePackageSource(artifactPath: string): string {
  const nodeModulesIndex = artifactPath.indexOf("node_modules/");
  if (nodeModulesIndex < 0) return "";
  const afterNodeModules = artifactPath.substring(
    nodeModulesIndex + "node_modules/".length,
  );
  const parts = afterNodeModules.split(path.sep);
  if (parts[0]?.startsWith("@") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0] ?? "";
}

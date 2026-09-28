/**
 * Serialize the artifact to a formatted JSON string.
 */
import type { Artifact } from "./types.js";

export default function serializeArtifact(artifact: Artifact): string {
  return JSON.stringify(artifact, null, 2);
}

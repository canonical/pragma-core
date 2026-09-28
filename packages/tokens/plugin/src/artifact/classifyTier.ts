/**
 * Classify a token's tier based on its source set.
 *
 * @param tokenId - DTCG token ID
 * @param setName - Set name from the resolver ("primitive" | "semantic")
 * @returns The tier classification.
 */
import type { TokenTier } from "./types.js";

export default function classifyTier(
  _tokenId: string,
  setName: string | undefined,
): TokenTier {
  if (setName === "primitive") {
    return "primitive";
  }
  return "semantic";
}

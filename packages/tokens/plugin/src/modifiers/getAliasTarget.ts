/**
 * Extract the alias target from a token via the standard DTCG `aliasOf` field.
 */
import type { OverlayToken } from "./types.js";

export default function getAliasTarget(
  token: OverlayToken,
): string | undefined {
  return token.aliasOf;
}

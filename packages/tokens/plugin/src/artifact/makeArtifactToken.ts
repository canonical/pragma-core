/**
 * Create an artifact token entry for a DTCG-sourced token.
 */
import type { ArtifactToken, ArtifactTokenInit } from "./types.js";

export default function makeArtifactToken(
  params: ArtifactTokenInit,
): ArtifactToken {
  const isPaired =
    params.valueLight !== undefined &&
    params.valueDark !== undefined &&
    params.valueLight !== params.valueDark;

  const token: ArtifactToken = {
    cssVar: params.cssVar,
    id: params.id,
    type: params.type,
    tier: params.tier,
    visibility: params.visibility,
    isPaired,
    cssOutputFile: params.cssOutputFile,
  };

  if (params.description !== undefined) {
    token.description = params.description;
  }
  if (params.declarations !== undefined && params.declarations.length > 0) {
    token.declarations = params.declarations;
  }
  if (params.aliasChain !== undefined) {
    token.aliasChain = params.aliasChain;
  }
  if (params.extensions !== undefined) {
    token.extensions = params.extensions;
  }
  if (params.valueLight !== undefined) {
    token.valueLight = params.valueLight;
  }
  if (params.valueDark !== undefined) {
    token.valueDark = params.valueDark;
  }
  if (params.sourceFile !== undefined) {
    token.sourceFile = params.sourceFile;
  }
  if (params.sourceLine !== undefined) {
    token.sourceLine = params.sourceLine;
  }

  return token;
}

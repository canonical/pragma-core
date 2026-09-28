/**
 * Create an artifact token entry for a plugin-generated token.
 */
import type { ArtifactToken, DerivedArtifactTokenInit } from "./types.js";

export default function makeDerivedArtifactToken(
  params: DerivedArtifactTokenInit,
): ArtifactToken {
  const isPaired =
    params.valueLight !== undefined &&
    params.valueDark !== undefined &&
    params.valueLight !== params.valueDark;

  const token: ArtifactToken = {
    cssVar: params.cssVar,
    id: null,
    type: params.type,
    tier: params.tier,
    visibility: params.visibility,
    isPaired,
    cssOutputFile: params.cssOutputFile,
    derivedFrom: params.derivedFrom,
    derivation: params.derivation,
  };

  if (params.description !== undefined) {
    token.description = params.description;
  }
  if (params.declarations !== undefined && params.declarations.length > 0) {
    token.declarations = params.declarations;
  }
  if (params.valueLight !== undefined) {
    token.valueLight = params.valueLight;
  }
  if (params.valueDark !== undefined) {
    token.valueDark = params.valueDark;
  }

  return token;
}

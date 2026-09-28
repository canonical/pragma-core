/**
 * Artifact schema types shared with the LSP consumer.
 *
 * These mirror the canonical token-artifact contract produced by the plugin.
 */
import type {
  Artifact,
  ArtifactAtRule,
  ArtifactDeclaration,
  ArtifactDerivationFields,
  ArtifactDerivationKind,
  ArtifactTier,
  ArtifactToken,
  ArtifactTokenInit,
  DerivationKind,
  DerivedArtifactTokenInit,
  DtcgTokenType,
  KnownDerivationKind,
  KnownDtcgTokenType,
  KnownTokenTier,
  TokenTier,
  TokenVisibility,
  WrappedArtifactEnvelope,
} from "@canonical/token-types";

export type {
  Artifact,
  ArtifactAtRule,
  ArtifactDeclaration,
  ArtifactDerivationFields,
  ArtifactDerivationKind,
  ArtifactTier,
  ArtifactToken,
  ArtifactTokenInit,
  DerivationKind,
  DerivedArtifactTokenInit,
  DtcgTokenType,
  KnownDerivationKind,
  KnownDtcgTokenType,
  KnownTokenTier,
  TokenTier,
  TokenVisibility,
  WrappedArtifactEnvelope,
};

/** Artifact entry emitted for primitive source tokens. */
export type PrimitiveArtifactToken = ArtifactToken & {
  tier: "primitive";
  id: string;
  valueLight: string;
};

/** Artifact entry emitted for semantic source tokens. */
export type SemanticArtifactToken = ArtifactToken & {
  tier: "semantic";
};

/** Artifact entry emitted for plugin-derived tokens. */
export type DerivedArtifactToken = ArtifactToken & {
  tier: "derived";
  id: null;
  derivedFrom: string;
};

/** Any artifact entry that has derivation metadata. */
export type DerivedArtifactLike = ArtifactToken & {
  derivedFrom: string;
};

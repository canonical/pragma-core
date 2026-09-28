/**
 * Type-level tests for @canonical/token-types (Q34).
 *
 * Uses vitest `expectTypeOf` to verify the type contracts at compile time.
 * No runtime assertions — these tests validate the type system only.
 */
import { describe, expectTypeOf, it } from "vitest";
import type {
  Artifact,
  ArtifactDerivationFields,
  ArtifactTokenInit,
  ArtifactTier,
  ArtifactMetadataFields,
  ArtifactRegistrationFields,
  ArtifactResolvedValueFields,
  ArtifactSourceFields,
  ArtifactToken,
  DtcgTokenType,
  DerivedArtifactTokenInit,
  KnownTokenTier,
  TokenTier,
  DerivationKind,
  ArtifactDeclaration,
  ArtifactDerivationKind,
  ArtifactAtRule,
  ArtifactEnvelope,
  KnownDerivationKind,
  KnownDtcgTokenType,
  WrappedArtifactEnvelope,
} from "../index.js";

describe("DtcgTokenType", () => {
  it("exposes the shared known DTCG literals as a narrower contract", () => {
    expectTypeOf<"color">().toMatchTypeOf<KnownDtcgTokenType>();
    expectTypeOf<"duration">().toMatchTypeOf<KnownDtcgTokenType>();
    expectTypeOf<"gradient">().toMatchTypeOf<KnownDtcgTokenType>();
  });

  it("accepts known DTCG type literals", () => {
    expectTypeOf<"color">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"dimension">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"number">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"typography">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"fontFamily">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"fontWeight">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"fontStyle">().toMatchTypeOf<DtcgTokenType>();
  });

  it("accepts arbitrary strings (backward compat)", () => {
    expectTypeOf<"custom-type">().toMatchTypeOf<DtcgTokenType>();
    expectTypeOf<"unknown">().toMatchTypeOf<DtcgTokenType>();
  });

  it("is assignable to ArtifactToken.type", () => {
    expectTypeOf<ArtifactToken["type"]>().toEqualTypeOf<DtcgTokenType>();
  });
});

describe("TokenTier", () => {
  it("is a union of three known literals", () => {
    expectTypeOf<"primitive">().toMatchTypeOf<TokenTier>();
    expectTypeOf<"semantic">().toMatchTypeOf<TokenTier>();
    expectTypeOf<"derived">().toMatchTypeOf<TokenTier>();
  });

  it("rejects unknown tiers", () => {
    expectTypeOf<"unknown">().not.toMatchTypeOf<TokenTier>();
  });

  it("exposes an open artifact tier contract for consumers", () => {
    expectTypeOf<"semantic">().toMatchTypeOf<KnownTokenTier>();
    expectTypeOf<"vendor-custom">().toMatchTypeOf<ArtifactTier>();
  });
});

describe("DerivationKind", () => {
  it("includes hover, active, disabled, delta, channel-modifier, channel-surface", () => {
    expectTypeOf<"hover">().toMatchTypeOf<DerivationKind>();
    expectTypeOf<"active">().toMatchTypeOf<DerivationKind>();
    expectTypeOf<"disabled">().toMatchTypeOf<DerivationKind>();
    expectTypeOf<"delta">().toMatchTypeOf<DerivationKind>();
    expectTypeOf<"channel-modifier">().toMatchTypeOf<DerivationKind>();
    expectTypeOf<"channel-surface">().toMatchTypeOf<DerivationKind>();
  });

  it("exposes an open artifact derivation contract for consumers", () => {
    expectTypeOf<"hover">().toMatchTypeOf<KnownDerivationKind>();
    expectTypeOf<"vendor-transform">().toMatchTypeOf<ArtifactDerivationKind>();
  });
});

describe("ArtifactToken", () => {
  it("has required fields", () => {
    expectTypeOf<ArtifactToken>().toHaveProperty("cssVar");
    expectTypeOf<ArtifactToken>().toHaveProperty("id");
    expectTypeOf<ArtifactToken>().toHaveProperty("type");
    expectTypeOf<ArtifactToken>().toHaveProperty("tier");
    expectTypeOf<ArtifactToken>().toHaveProperty("isPaired");
    expectTypeOf<ArtifactToken>().toHaveProperty("cssOutputFile");
  });

  it("has optional derived-tier fields", () => {
    expectTypeOf<ArtifactToken["derivedFrom"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<ArtifactToken["derivation"]>().toEqualTypeOf<
      ArtifactDerivationKind | undefined
    >();
  });

  it("id is string | null (derived tokens have null id)", () => {
    expectTypeOf<ArtifactToken["id"]>().toEqualTypeOf<string | null>();
  });

  it("uses the open artifact tier contract", () => {
    expectTypeOf<ArtifactToken["tier"]>().toEqualTypeOf<ArtifactTier>();
  });
});

describe("artifact token init contracts", () => {
  it("uses the shared DTCG vocabulary for DTCG-sourced token builders", () => {
    expectTypeOf<ArtifactTokenInit["type"]>().toEqualTypeOf<DtcgTokenType>();
  });

  it("uses the shared derivation contract for derived token builders", () => {
    expectTypeOf<DerivedArtifactTokenInit["derivation"]>().toEqualTypeOf<
      DerivationKind
    >();
  });
});

describe("shared artifact field groups", () => {
  it("keep shared metadata and runtime fields aligned", () => {
    expectTypeOf<ArtifactMetadataFields["type"]>().toEqualTypeOf<
      DtcgTokenType
    >();
    expectTypeOf<ArtifactResolvedValueFields["isPaired"]>().toEqualTypeOf<
      boolean
    >();
    expectTypeOf<ArtifactSourceFields["cssOutputFile"]>().toEqualTypeOf<
      string
    >();
    expectTypeOf<ArtifactRegistrationFields["syntax"]>().toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf<ArtifactDerivationFields["derivation"]>().toEqualTypeOf<
      ArtifactDerivationKind | undefined
    >();
  });
});

describe("ArtifactDeclaration", () => {
  it("has selector, file, and line", () => {
    expectTypeOf<ArtifactDeclaration>().toHaveProperty("selector");
    expectTypeOf<ArtifactDeclaration>().toHaveProperty("file");
    expectTypeOf<ArtifactDeclaration>().toHaveProperty("line");
  });

  it("has optional atRules array", () => {
    expectTypeOf<ArtifactDeclaration["atRules"]>().toEqualTypeOf<
      ArtifactAtRule[] | undefined
    >();
  });
});

describe("Artifact", () => {
  it("is Record<string, ArtifactToken>", () => {
    expectTypeOf<Artifact>().toEqualTypeOf<Record<string, ArtifactToken>>();
  });
});

describe("ArtifactEnvelope", () => {
  it("accepts flat artifact", () => {
    expectTypeOf<Artifact>().toMatchTypeOf<ArtifactEnvelope>();
  });

  it("accepts wrapped artifact", () => {
    expectTypeOf<WrappedArtifactEnvelope>().toMatchTypeOf<ArtifactEnvelope>();
  });
});

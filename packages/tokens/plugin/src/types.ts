/**
 * Public type barrel for @canonical/terrazzo-plugin-css.
 *
 * Definitions live next to their source domains; this file preserves the
 * package-level import surface for public consumers.
 */
export type {
  Artifact,
  ArtifactAtRule,
  ArtifactDeclaration,
  ArtifactDerivationFields,
  ArtifactTier,
  ArtifactToken,
  ArtifactTokenInit,
  DerivationKind,
  DerivedArtifactLike,
  DerivedArtifactToken,
  DerivedArtifactTokenInit,
  DtcgTokenType,
  KnownDtcgTokenType,
  KnownTokenTier,
  PrimitiveArtifactToken,
  SemanticArtifactToken,
  TokenTier,
  WrappedArtifactEnvelope,
} from "./artifact/types.js";
export type {
  BaseTokenLike,
  ColorTokenLike,
  MultiValueTransformResult,
  ResolvedTokenMap,
  SetTransformParams,
  SingleValueTransformResult,
  TokenLike,
  TokenMap,
  TokenSourceLike,
  TransformResult,
  TransformValue,
  TypographyTokenLike,
  UnknownTypedTokenLike,
} from "./build/shims.js";
export type {
  SetConfig,
  StateDelta,
  StatesConfig,
  TypographyConfig,
} from "./build/types.js";
export type {
  CSSDeclaration,
  CSSNode,
  CSSRule,
  PrintOptions,
} from "./css-ast/types.js";
export type { LayerConfig, ResolvedLayerConfig } from "./layers/types.js";
export type {
  LightDarkPair,
  ResolvedThemeConfig,
  ThemeColorScheme,
  ThemeConfig,
  ThemeSelectors,
} from "./light-dark/types.js";
export type {
  MediaModifierConfig,
  ModifierContext,
  OverlayToken,
  SurfaceConfig,
} from "./modifiers/types.js";
export type {
  CanonicalPluginOptions,
  LineHeightException,
  RationalCount,
} from "./plugin/types.js";

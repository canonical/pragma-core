/**
 * @canonical/terrazzo-plugin-css
 *
 * Custom Terrazzo plugin for Canonical design tokens.
 * Modifier contracts, light-dark pairing, layer wrapping, artifact emission.
 */

export {
  classifyTier,
  makeArtifactToken,
  makeDerivedArtifactToken,
  serializeArtifact,
} from "./artifact/index.js";
export {
  addDeclarationUnique,
  createDeclaration,
  createRule,
  hasDeclaration,
  printNode,
  printRules,
} from "./css-ast/index.js";
export { resolveLayerConfig, wrapInLayer } from "./layers/index.js";
export {
  buildLightDarkDeclarations,
  wrapLightDark,
} from "./light-dark/index.js";
export {
  buildModifierContextCSS,
  computeModifierContext,
  getAliasTarget,
} from "./modifiers/index.js";
export {
  assertUniqueCssVarNames,
  convertLegacyTokenIdToCssVar,
  convertTokenIdToCssVar,
  legacyCssVarForToken,
  prefixVar,
} from "./naming.js";
export { default as canonicalPlugin } from "./plugin/index.js";
export type {
  Artifact,
  ArtifactTier,
  ArtifactToken,
  ArtifactTokenInit,
  CanonicalPluginOptions,
  CSSDeclaration,
  CSSNode,
  CSSRule,
  DerivationKind,
  DerivedArtifactTokenInit,
  DtcgTokenType,
  KnownDtcgTokenType,
  KnownTokenTier,
  LayerConfig,
  LightDarkPair,
  LineHeightException,
  MediaModifierConfig,
  ModifierContext,
  OverlayToken,
  PrintOptions,
  RationalCount,
  ResolvedLayerConfig,
  ResolvedThemeConfig,
  SetConfig,
  StateDelta,
  StatesConfig,
  SurfaceConfig,
  ThemeColorScheme,
  ThemeConfig,
  ThemeSelectors,
  TokenTier,
  TypographyConfig,
  WrappedArtifactEnvelope,
} from "./types.js";

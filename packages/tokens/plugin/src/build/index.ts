/**
 * Build module barrel — re-exports all build helpers.
 */
export { annotateDeclarations } from "./annotation.js";
export {
  buildDescriptionLookup,
  buildFallbackChain,
  buildModifierFamily,
  buildSetsPrimitive,
  buildSetsSemantic,
  buildStates,
  buildSurfaces,
  buildTheme,
  buildTypography,
  convertCssValueToString,
  emitTypographyDecls,
} from "./builders/index.js";
export {
  isPrimitive,
  isSemanticColor,
  isSemanticTypography,
} from "./classification.js";
export { computeDeltas } from "./computeDeltas.js";
export { FORMAT } from "./constants/format.js";
export { HEADER } from "./constants/header.js";
export { interactiveRoles } from "./constants/interactiveRoles.js";
export { SURFACE_SELECTOR_MAP } from "./constants/surfaceSelectorMap.js";
export type { BuildContext } from "./context.js";
export { extractOklchL } from "./extractOklchL.js";
export { formatDelta } from "./formatDelta.js";
export type { ModifierFileData } from "./modifierIo.js";
export {
  extractModifierFileData,
  loadModifierData,
  walkTokenTree,
} from "./modifierIo.js";
export { recoverPrimitiveRef } from "./recoverPrimitiveRef.js";
export type {
  BaseTokenLike,
  ColorTokenLike,
  GetTransformsFn,
  MultiValueTransformResult,
  OutputFileFn,
  ResolvedTokenMap,
  ResolverLike,
  SetTransformFn,
  SetTransformParams,
  SingleValueTransformResult,
  TokenLike,
  TokenMap,
  TokenSourceLike,
  TransformResult,
  TransformValue,
  TypographyTokenLike,
  UnknownTypedTokenLike,
} from "./shims.js";
export { isColorTokenLike, isSingleValueTransformResult } from "./shims.js";
export type {
  DeltaDeclarations,
  InteractiveRole,
  OklchColorValue,
} from "./types.js";

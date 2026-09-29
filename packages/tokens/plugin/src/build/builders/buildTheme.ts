/**
 * Build helper for modifiers.theme.css — light-dark colour tokens and deltas.
 */
import { makeArtifactToken } from "../../artifact/index.js";
import type { Artifact, PrimitiveArtifactToken } from "../../artifact/types.js";
import {
  createDeclaration,
  createRule,
  printRules,
} from "../../css-ast/index.js";
import type { CSSNode } from "../../css-ast/types.js";
import { wrapInLayer } from "../../layers/index.js";
import type { ResolvedLayerConfig } from "../../layers/types.js";
import { buildLightDarkDeclarations } from "../../light-dark/index.js";
import type { LightDarkPair } from "../../light-dark/types.js";
import { convertTokenIdToCssVar, legacyCssVarForToken } from "../../naming.js";
import { isSemanticColor } from "../classification.js";
import { computeDeltas } from "../computeDeltas.js";
import { FORMAT } from "../constants/format.js";
import { HEADER } from "../constants/header.js";
import { interactiveRoles } from "../constants/interactiveRoles.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import { recoverPrimitiveRef } from "../recoverPrimitiveRef.js";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  TokenMap,
} from "../shims.js";
import type { SourceCatalog } from "../sourceCatalog.js";
import type { InteractiveRole } from "../types.js";

/** @note Mutates `artifact`, calls `outputFile`. */
export default function buildTheme(
  tokens: TokenMap,
  getTransforms: GetTransformsFn,
  resolver: ResolverLike,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  sourceCatalog: SourceCatalog | undefined,
  emittedProperties: EmittedPropertyRegistry,
  roles: InteractiveRole[] = interactiveRoles,
) {
  // Collect base (light) and dark transforms for colour tokens
  const baseTransforms = getTransforms({ format: FORMAT });
  const darkTransforms = getTransforms({
    format: FORMAT,
    input: { theme: "dark" },
  });

  // Index dark transforms by token ID
  const darkById = new Map<string, string>();
  for (const t of darkTransforms) {
    if (t.type !== "SINGLE_VALUE") continue;
    darkById.set(t.id, t.value);
  }

  // Build a reverse index: resolved literal value → primitive var name.
  // When a semantic token resolves to the same literal as a primitive,
  // we emit var(--primitive) instead of the raw oklch value.
  const primitiveByValue = new Map<string, string>();
  for (const [cssVar, entry] of Object.entries(artifact)) {
    if (
      entry.tier === "primitive" &&
      entry.type === "color" &&
      entry.valueLight
    ) {
      const primitiveEntry = entry as PrimitiveArtifactToken;
      if (!primitiveByValue.has(primitiveEntry.valueLight)) {
        primitiveByValue.set(primitiveEntry.valueLight, cssVar);
      }
    }
  }

  // Build light-dark pairs for semantic colour tokens
  const pairs: LightDarkPair[] = [];
  const seenIds = new Set<string>();

  for (const t of baseTransforms) {
    if (!isSemanticColor(t.token, t.id, sourceCatalog)) continue;
    if (t.type !== "SINGLE_VALUE") continue;
    if (seenIds.has(t.id)) continue;
    seenIds.add(t.id);

    const cssVar = convertTokenIdToCssVar(t.id);
    const rawLight = t.value;
    const rawDark = darkById.get(t.id) ?? rawLight;

    // Recover var() references to primitives
    const lightVal = recoverPrimitiveRef(rawLight, cssVar, primitiveByValue);
    const darkVal = recoverPrimitiveRef(rawDark, cssVar, primitiveByValue);

    emittedProperties.register(cssVar, t.id);
    pairs.push({ property: cssVar, light: lightVal, dark: darkVal });

    artifact[cssVar] = makeArtifactToken({
      cssVar,
      id: t.id,
      type: "color",
      tier: "semantic",
      visibility: "public",
      cssOutputFile: "modifiers.theme.css",
      description: t.token.$description,
      extensions: t.token.$extensions,
      valueLight: lightVal,
      valueDark: darkVal,
      sourceFile:
        sourceCatalog?.get(t.id)?.sourceFile ?? t.token.source?.filename,
    });
  }

  // Build CSS
  const themeDecls = buildLightDarkDeclarations(pairs);
  const compatibilityDecls = pairs.flatMap(({ property }) => {
    const tokenId = artifact[property]?.id;
    if (!tokenId) return [];
    const legacy = legacyCssVarForToken(tokenId);
    if (!legacy) return [];
    emittedProperties.register(legacy, `${tokenId}::legacy`);
    return [createDeclaration(legacy, `var(${property})`)];
  });

  // Compute NativeState deltas (task 2.9)
  const { lightDeltaDecls, darkDeltaDecls } = computeDeltas(
    tokens,
    resolver,
    artifact,
    emittedProperties,
    roles,
  );

  // Assemble :root block
  const rootNodes: CSSNode[] = [
    createDeclaration("color-scheme", "light dark"),
    ...themeDecls,
    ...compatibilityDecls,
    ...lightDeltaDecls,
  ];
  const rootRule = createRule([":root"], rootNodes);

  // Override selectors
  const lightOverride = createRule(
    [".light"],
    [createDeclaration("color-scheme", "light")],
  );
  const darkOverride = createRule(
    [".dark"],
    [createDeclaration("color-scheme", "dark"), ...darkDeltaDecls],
  );
  // Scope to :root:not(.light) so an explicit `.light` opt-out on a dark OS
  // keeps the light deltas (from the base :root block) instead of being
  // overridden by the dark-scheme media block. Adding light deltas to `.light`
  // would not help: `.light` and the media `:root` have equal specificity and
  // the media block comes later in source order.
  const mediaQuery = createRule(
    ["@media (prefers-color-scheme: dark)"],
    [createRule([":root:not(.light)"], darkDeltaDecls)],
  );

  const wrapped = wrapInLayer(layers.modifiers, [
    rootRule,
    lightOverride,
    darkOverride,
    mediaQuery,
  ]);
  outputFile("modifiers.theme.css", `${HEADER}\n${printRules(wrapped)}\n`);
}

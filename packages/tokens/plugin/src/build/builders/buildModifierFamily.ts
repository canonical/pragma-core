import { makeDerivedArtifactToken } from "../../artifact/index.js";
import type { Artifact } from "../../artifact/types.js";
import {
  createDeclaration,
  createRule,
  printRules,
} from "../../css-ast/index.js";
import type { CSSNode } from "../../css-ast/types.js";
import { wrapInLayer } from "../../layers/index.js";
import type { ResolvedLayerConfig } from "../../layers/types.js";
import {
  buildModifierContextCSS,
  computeModifierContext,
} from "../../modifiers/index.js";
import type { OverlayToken } from "../../modifiers/types.js";
import { convertTokenIdToCssVar, prefixVar } from "../../naming.js";
import { HEADER } from "../constants/header.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import { loadModifierData } from "../modifierIo.js";
import type { OutputFileFn, ResolverLike } from "../shims.js";
import buildDescriptionLookup from "./buildDescriptionLookup.js";

/** Build a modifier family stylesheet. */
export default function buildModifierFamily(
  family: string,
  resolver: ResolverLike,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  tokensDir: string,
  emittedProperties: EmittedPropertyRegistry,
) {
  const baseTokens = resolver.apply({});
  const typeByCssVar = new Map(
    Object.entries(baseTokens).map(([id, token]) => [
      convertTokenIdToCssVar(id),
      token.$type ?? "unknown",
    ]),
  );
  const modifiers = resolver.source?.modifiers;
  const familyMod = modifiers?.[family];
  if (!familyMod?.contexts) {
    return;
  }

  const allNodes: CSSNode[] = [];
  const tokenIdByChannel = new Map(
    Object.keys(baseTokens).map((id) => [
      prefixVar(convertTokenIdToCssVar(id), "modifier"),
      id,
    ]),
  );
  const defaultTokenIds: string[] = [];

  for (const context of Object.keys(familyMod.contexts)) {
    if (context === "none" || context === "default") {
      continue;
    }
    const { descriptions } = loadModifierData(tokensDir, family, context);
    const overlayTokens = resolver.apply({ [family]: context });
    const descByChannelVar = buildDescriptionLookup(descriptions, "modifier");

    const modifierContext = computeModifierContext(
      family,
      context,
      baseTokens as Record<string, OverlayToken>,
      overlayTokens as Record<string, OverlayToken>,
      "modifier",
    );

    allNodes.push(...buildModifierContextCSS(modifierContext));

    for (const declaration of modifierContext.declarations) {
      const tokenId = tokenIdByChannel.get(declaration.property);
      if (tokenId && !defaultTokenIds.includes(tokenId)) {
        defaultTokenIds.push(tokenId);
      }
      emittedProperties.register(
        declaration.property,
        `derived:${declaration.property}`,
      );
      // First write wins: a channel (e.g. --modifier-color-border) is declared
      // across many contexts and families. Overwriting made the scalar
      // derivedFrom/cssOutputFile non-deterministic (last-family-wins). The
      // authoritative per-site list is captured in declarations[] by
      // annotateDeclarations after all CSS is emitted.
      if (declaration.property in artifact) continue;
      const derivedFrom = declaration.value
        .replace(/^var\(/, "")
        .replace(/\)$/, "");
      artifact[declaration.property] = makeDerivedArtifactToken({
        cssVar: declaration.property,
        type: typeByCssVar.get(derivedFrom) ?? "unknown",
        tier: "semantic",
        visibility: "internal",
        cssOutputFile: `modifiers.${family}.css`,
        derivedFrom,
        derivation: "channel-modifier",
        description: descByChannelVar[declaration.property],
      });
    }
  }

  // The "default" context rebinds every channel the family emits back to its
  // own base token, so an element opting into it overrides inherited channels
  // instead of falling through to them.
  if ("default" in familyMod.contexts && defaultTokenIds.length > 0) {
    allNodes.push(
      createRule(
        [".default"],
        defaultTokenIds.map((id) => {
          const cssVar = convertTokenIdToCssVar(id);
          return createDeclaration(
            prefixVar(cssVar, "modifier"),
            `var(${cssVar})`,
          );
        }),
      ),
    );
  }

  const wrapped = wrapInLayer(layers.modifiers, allNodes);
  outputFile(`modifiers.${family}.css`, `${HEADER}\n${printRules(wrapped)}\n`);
}

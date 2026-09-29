import { makeDerivedArtifactToken } from "../../artifact/index.js";
import type { Artifact } from "../../artifact/types.js";
import { printRules } from "../../css-ast/index.js";
import type { CSSDeclaration, CSSNode } from "../../css-ast/types.js";
import { wrapInLayer } from "../../layers/index.js";
import type { ResolvedLayerConfig } from "../../layers/types.js";
import {
  buildModifierContextCSS,
  computeModifierContext,
} from "../../modifiers/index.js";
import type { OverlayToken } from "../../modifiers/types.js";
import { HEADER } from "../constants/header.js";
import { SURFACE_SELECTOR_MAP } from "../constants/surfaceSelectorMap.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import { loadModifierData } from "../modifierIo.js";
import type { OutputFileFn, ResolverLike } from "../shims.js";
import buildDescriptionLookup from "./buildDescriptionLookup.js";

/**
 * The description of the base token a reset points back at.
 *
 * A reset is synthesised from the profile rather than read from a source file,
 * so it has no entry in the source's description lookup — and with the layer1
 * and modal files reduced to headers, that is every one of their variables.
 * Left alone, the 15 shared `--surface-*` artifact entries lose the
 * descriptions they had, because the first context written wins and layer1 is
 * written first. The value is `var(--x)`, and `--x` is a token we hold.
 */
function makeBaseDescription(baseTokens: Record<string, OverlayToken>) {
  return (value: string): string | undefined => {
    const match = /^var\(--([^)]+)\)$/.exec(value);
    if (!match) return undefined;
    const id = match[1].replaceAll("-", ".");
    return (baseTokens[id] as { $description?: string } | undefined)
      ?.$description;
  };
}

/** Build the surfaces stylesheet. */
export default function buildSurfaces(
  resolver: ResolverLike,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  tokensDir: string,
  emittedProperties: EmittedPropertyRegistry,
  surfaceSelectors: Record<string, string> = SURFACE_SELECTOR_MAP,
  surfaceEmits: Record<string, readonly string[]> | undefined = undefined,
  surfaceResets?: Record<string, readonly string[]>,
  /**
   * Whether the emission set was authored rather than defaulted.
   *
   * The exhaustiveness check below exists to catch a mistake in a profile
   * someone wrote. The compiled fallback is OUR shape, and a consumer whose
   * resolver has different surface contexts has made no mistake by not
   * matching it — so a defaulted set is narrowed to the live contexts instead
   * of failing the build.
   */
  emitsAuthored = true,
) {
  const baseTokens = resolver.apply({});
  const baseDescription = makeBaseDescription(
    baseTokens as Record<string, OverlayToken>,
  );
  const modifiers = resolver.source?.modifiers;
  const surfaceMod = modifiers?.surface;
  if (!surfaceMod?.contexts) {
    return;
  }

  // A declared emission set must name every context, and only contexts that
  // exist. Checked before the first context is built, because the two ways it
  // can be wrong are both silent otherwise: a missing or mistyped key leaves
  // that context inferring its emission — the very thing declaring it removes
  // — and a key for a context that no longer exists is never visited at all.
  const live = Object.keys(surfaceMod.contexts).filter((c) => c !== "none");

  // A DEFAULTED set describes the shape it was generated from, and nothing
  // else. Applied to a resolver with different surface contexts it would
  // assert our fifteen variables against someone else's tokens, so it is used
  // only when the contexts match exactly; otherwise emission is inferred, as
  // it was before any of this was declared.
  if (surfaceEmits && !emitsAuthored) {
    const declaredContexts = Object.keys(surfaceEmits);
    const sameShape =
      declaredContexts.length === live.length &&
      live.every((c) => declaredContexts.includes(c));
    if (!sameShape) surfaceEmits = undefined;
  }

  if (surfaceEmits && emitsAuthored) {
    const declared = Object.keys(surfaceEmits);
    const missing = live.filter((c) => !declared.includes(c));
    const unknown = declared.filter((c) => !live.includes(c));
    if (missing.length > 0 || unknown.length > 0) {
      throw new Error(
        [
          "surface emission set does not match the resolver's contexts:",
          missing.length > 0 ? `missing ${missing.join(", ")}` : "",
          unknown.length > 0 ? `unknown ${unknown.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  }

  const allNodes: CSSNode[] = [];

  for (const context of Object.keys(surfaceMod.contexts)) {
    if (context === "none") {
      continue;
    }
    const { descriptions } = loadModifierData(tokensDir, "surface", context);
    const overlayTokens = resolver.apply({ surface: context });
    const descByChannelVar = buildDescriptionLookup(descriptions, "surface");

    const surfaceContext = computeModifierContext(
      "surface",
      context,
      baseTokens as Record<string, OverlayToken>,
      overlayTokens as Record<string, OverlayToken>,
      "surface",

      surfaceSelectors[context],
    );

    // Emission is DECLARED, not inferred.
    //
    // `computeModifierContext` decides what a context overrides from the shape
    // of its source file — the aliases it happens to declare, plus a
    // value-comparison heuristic for the rest. That made the emitted API a
    // function of how the source was authored, so the source could not be
    // restructured without moving the output.
    //
    // The profile now says which variables a context emits. The filter bounds
    // the set from above; the assertion below bounds it from BELOW, so a
    // source change that would silently stop producing a declared variable is
    // an error rather than a quiet removal from the shipped API.
    const declared = surfaceEmits?.[context];
    if (declared) {
      const resets = new Set(surfaceResets?.[context] ?? []);
      const byProperty = new Map(
        surfaceContext.declarations.map((d) => [d.property, d]),
      );

      // A RESET is a variable the context emits without overriding anything:
      // `--surface-x: var(--x)`, which sends a nested surface back to the
      // unmodified value. It has no source token and cannot have one — an
      // alias naming the very node it sits on is circular once the override
      // moves to `$root` — so the profile states it and the build writes it.
      const missing = declared.filter(
        (name) => !resets.has(name) && !byProperty.has(`--surface-${name}`),
      );
      if (missing.length > 0) {
        throw new Error(
          `surface context "${context}" declares ${missing.length} variable(s) it no longer produces: ${missing.map((n) => `--surface-${n}`).join(", ")}`,
        );
      }
      // A reset must be one of the variables this context declares. Without
      // this, a typo names a variable nothing emits and nothing checks: it is
      // absent from `missing` (which walks `declared`) and absent from
      // `stray` (which only fires when the source produces it), so it is
      // silently ignored despite the contract saying every reset is emitted.
      const unemitted = [...resets].filter((name) => !declared.includes(name));
      if (unemitted.length > 0) {
        throw new Error(
          `surface context "${context}" declares ${unemitted.length} reset(s) it does not emit: ${unemitted.map((n) => `--surface-${n}`).join(", ")}`,
        );
      }
      const stray = [...resets].filter((name) =>
        byProperty.has(`--surface-${name}`),
      );
      if (stray.length > 0) {
        throw new Error(
          `surface context "${context}" declares ${stray.length} reset(s) the source also produces: ${stray.map((n) => `--surface-${n}`).join(", ")}`,
        );
      }

      // Order comes from the profile too. Emitting in the declared order means
      // a source reshuffle cannot move a line, which is what a byte gate needs
      // in order to mean something.
      surfaceContext.declarations = declared.map(
        (name): CSSDeclaration =>
          byProperty.get(`--surface-${name}`) ?? {
            type: "Declaration",
            property: `--surface-${name}`,
            value: `var(--${name})`,
          },
      );
    }

    allNodes.push(...buildModifierContextCSS(surfaceContext));

    for (const declaration of surfaceContext.declarations) {
      emittedProperties.register(
        declaration.property,
        `derived:${declaration.property}`,
      );
      // First write wins: surface channels recur across contexts; the scalar
      // fields stay deterministic here while declarations[] (populated by
      // annotateDeclarations) carries the full per-site list.
      if (declaration.property in artifact) continue;
      artifact[declaration.property] = makeDerivedArtifactToken({
        cssVar: declaration.property,
        type: "color",
        tier: "semantic",
        visibility: "internal",
        cssOutputFile: "modifiers.surfaces.css",
        derivedFrom: declaration.value.replace(/^var\(/, "").replace(/\)$/, ""),
        derivation: "channel-surface",
        description:
          descByChannelVar[declaration.property] ??
          baseDescription(declaration.value),
      });
    }
  }

  const wrapped = wrapInLayer(layers.surfaces, allNodes);
  outputFile("modifiers.surfaces.css", `${HEADER}\n${printRules(wrapped)}\n`);
}

import { transformCSSValue } from "@terrazzo/token-tools/css";
import { serializeArtifact } from "../artifact/index.js";
import type { Artifact } from "../artifact/types.js";
import { annotateDeclarations } from "../build/annotation.js";
import buildModifierFamily from "../build/builders/buildModifierFamily.js";
import buildSetsPrimitive from "../build/builders/buildSetsPrimitive.js";
import buildSetsSemantic from "../build/builders/buildSetsSemantic.js";
import buildSpacing from "../build/builders/buildSpacing.js";
import buildStates from "../build/builders/buildStates.js";
import buildSurfaces from "../build/builders/buildSurfaces.js";
import buildTheme from "../build/builders/buildTheme.js";
import buildTypography from "../build/builders/buildTypography.js";
import convertCssValueToString from "../build/builders/convertCssValueToString.js";
import {
  isSemanticSpacing,
  isSemanticTypography,
} from "../build/classification.js";
import { FORMAT } from "../build/constants/format.js";
import { interactiveRoles } from "../build/constants/interactiveRoles.js";
import {
  SURFACE_EMITS,
  SURFACE_RESETS,
} from "../build/constants/surfaceEmission.js";
import { SURFACE_SELECTOR_MAP } from "../build/constants/surfaceSelectorMap.js";
import EmittedPropertyRegistry from "../build/emittedPropertyRegistry.js";
import { validateLineHeightLattice } from "../build/lineHeightLattice.js";
import { productContexts, productInput } from "../build/productAxis.js";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  SetTransformFn,
  TokenMap,
} from "../build/shims.js";
import { isColorTokenLike } from "../build/shims.js";
import {
  loadSourceCatalog,
  type SourceCatalog,
} from "../build/sourceCatalog.js";
import { resolveLayerConfig } from "../layers/index.js";
import { assertUniqueCssVarNames, convertTokenIdToCssVar } from "../naming.js";
import type { CanonicalPluginOptions } from "./types.js";

/** Create the Canonical CSS plugin for Terrazzo. */
export default function canonicalPlugin(options: CanonicalPluginOptions = {}) {
  const layers = resolveLayerConfig(options.layers);
  const tokensDir = options.tokensDir ?? "./tokens/canonical";
  // S2 and S4 arrive as data, never as an import: the ontology package already
  // depends on this plugin's output, so importing its contracts would close a
  // cycle. Absent, the compiled constants stand in and nothing changes.
  const roles = options.contracts?.roles ?? interactiveRoles;
  // Merged onto the defaults rather than replacing them. A profile naming one
  // context would otherwise silently drop the other four to their bare class
  // name — `.layer2` instead of `.surface .surface` — which is a depth change,
  // not a missing entry.
  const surfaceSelectors = {
    ...SURFACE_SELECTOR_MAP,
    ...options.profile?.surfaceSelectors,
  };
  // Defaults, for the same reason the selectors have them: a plugin used
  // without a profile must behave as before. Without these, the layer1 and
  // modal contexts — whose source files are now headers with no tokens —
  // would infer an empty emission and stop resetting anything.
  const emitsAuthored = options.profile?.surfaceEmits !== undefined;
  const surfaceEmits = options.profile?.surfaceEmits ?? SURFACE_EMITS;
  const surfaceResets = options.profile?.surfaceResets ?? SURFACE_RESETS;
  const families = options.families ?? [
    "anticipation",
    "criticality",
    "emphasis",
    "importance",
    "lifecycle",
    "release",
  ];

  return {
    name: "@canonical/terrazzo-plugin-css",

    async transform({
      tokens,
      setTransform,
      resolver,
    }: {
      tokens: TokenMap;
      setTransform: SetTransformFn;
      resolver: ResolverLike;
    }) {
      const sourceCatalog = loadSourceCatalog(tokensDir);
      assertUniqueCssVarNames([
        ...Object.keys(tokens),
        ...(sourceCatalog.ids?.() ?? []),
      ]);
      transformBaseSet(resolver, setTransform);
      transformDarkTheme(resolver, setTransform);
      validateLineHeightLattice(
        resolver,
        sourceCatalog,
        options.contracts?.lineHeightExceptions,
        options.contracts?.requireProductBaseline,
      );
      transformProductContexts(tokens, resolver, setTransform, sourceCatalog);
    },

    async build({
      tokens,
      getTransforms,
      resolver,
      outputFile,
    }: {
      tokens: TokenMap;
      getTransforms: GetTransformsFn;
      resolver: ResolverLike;
      outputFile: OutputFileFn;
    }) {
      const sourceCatalog = loadSourceCatalog(tokensDir);
      const artifact: Artifact = {};
      const emittedProperties = new EmittedPropertyRegistry();
      const cssOutputs = new Map<string, string>();
      const capture: OutputFileFn = (file, contents) => {
        if (typeof contents === "string" && file.endsWith(".css")) {
          cssOutputs.set(file, contents);
        }
        outputFile(file, contents);
      };

      buildSetsPrimitive(
        getTransforms,
        layers,
        artifact,
        capture,
        sourceCatalog,
        emittedProperties,
      );
      buildSetsSemantic(
        getTransforms,
        layers,
        artifact,
        capture,
        sourceCatalog,
        emittedProperties,
      );
      buildSpacing(
        getTransforms,
        resolver,
        layers,
        artifact,
        capture,
        sourceCatalog,
        emittedProperties,
      );
      buildTheme(
        tokens,
        getTransforms,
        resolver,
        layers,
        artifact,
        capture,
        sourceCatalog,
        emittedProperties,
        roles,
      );
      buildTypography(
        getTransforms,
        resolver,
        layers,
        artifact,
        capture,
        sourceCatalog,
        emittedProperties,
      );
      for (const family of families) {
        buildModifierFamily(
          family,
          resolver,
          layers,
          artifact,
          capture,
          tokensDir,
          emittedProperties,
        );
      }
      buildSurfaces(
        resolver,
        layers,
        artifact,
        capture,
        tokensDir,
        emittedProperties,
        surfaceSelectors,
        surfaceEmits,
        surfaceResets,
        emitsAuthored,
      );
      buildStates(
        tokens,
        resolver,
        layers,
        artifact,
        capture,
        emittedProperties,
        roles,
      );
      annotateDeclarations(artifact, cssOutputs);
      outputFile("tokens.json", serializeArtifact(artifact));
    },
  };
}

function transformBaseSet(
  resolver: ResolverLike,
  setTransform: SetTransformFn,
) {
  const baseSet = resolver.apply({});
  for (const [id] of Object.entries(baseSet)) {
    const cssVar = convertTokenIdToCssVar(id);
    const value = transformCSSValue(baseSet[id] as never, {
      tokensSet: baseSet as never,
      permutation: {},
    });
    const stringValue = convertCssValueToString(
      value as string | Record<string, string>,
    );
    if (stringValue !== null) {
      setTransform(id, { format: FORMAT, localID: cssVar, value: stringValue });
    } else {
      setTransform(id, {
        format: FORMAT,
        localID: cssVar,
        value: value as Record<string, string>,
      });
    }
  }
}

function transformDarkTheme(
  resolver: ResolverLike,
  setTransform: SetTransformFn,
) {
  const darkSet = resolver.apply({ theme: "dark" });
  for (const [id, token] of Object.entries(darkSet)) {
    if (!isColorTokenLike(token)) {
      continue;
    }
    const cssVar = convertTokenIdToCssVar(id);
    const value = transformCSSValue(token as never, {
      tokensSet: darkSet as never,
      permutation: { theme: "dark" },
    });
    const stringValue = convertCssValueToString(
      value as string | Record<string, string>,
    );
    if (stringValue !== null) {
      setTransform(id, {
        format: FORMAT,
        localID: cssVar,
        value: stringValue,
        input: { theme: "dark" },
      });
    }
  }
}

function transformProductContexts(
  tokens: TokenMap,
  resolver: ResolverLike,
  setTransform: SetTransformFn,
  sourceCatalog: SourceCatalog,
) {
  for (const context of productContexts(resolver)) {
    const input = productInput(resolver, context);
    const typographySet = resolver.apply(input);
    for (const [id, token] of Object.entries(typographySet)) {
      if (
        (!isSemanticTypography(token, id, sourceCatalog) &&
          !isSemanticSpacing(token, id, sourceCatalog)) ||
        !(id in tokens)
      ) {
        continue;
      }
      const cssVar = convertTokenIdToCssVar(id);
      let value: unknown;
      try {
        value = transformCSSValue(typographySet[id] as never, {
          tokensSet: typographySet as never,
          permutation: input,
        });
      } catch (error) {
        throw new Error(
          `[canonical-css] Failed to transform ${id} for ${context}: ${error instanceof Error ? error.message : error}`,
        );
      }
      const stringValue = convertCssValueToString(
        value as string | Record<string, string>,
      );
      if (stringValue !== null) {
        setTransform(id, {
          format: FORMAT,
          localID: cssVar,
          value: stringValue,
          input,
        });
      } else {
        setTransform(id, {
          format: FORMAT,
          localID: cssVar,
          value: value as Record<string, string>,
          input,
        });
      }
    }
  }
}

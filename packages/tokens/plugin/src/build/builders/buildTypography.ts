/**
 * Build helper for modifiers.typography.css — base + per-product typography.
 */
import { transformCSSValue } from "@terrazzo/token-tools/css";
import { makeArtifactToken } from "../../artifact/index.js";
import type { Artifact } from "../../artifact/types.js";
import {
  createDeclaration,
  createRule,
  printRules,
} from "../../css-ast/index.js";
import type { CSSNode } from "../../css-ast/types.js";
import { wrapInLayer } from "../../layers/index.js";
import type { ResolvedLayerConfig } from "../../layers/types.js";
import { convertTokenIdToCssVar, legacyCssVarForToken } from "../../naming.js";
import { classifySourceRole, isSemanticTypography } from "../classification.js";
import { FORMAT } from "../constants/format.js";
import { HEADER } from "../constants/header.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import { productContexts, productInput } from "../productAxis.js";
import resolveTypographyExtensions from "../resolveTypographyExtensions.js";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  TransformResult,
} from "../shims.js";
import type { SourceCatalog } from "../sourceCatalog.js";
import convertCssValueToString from "./convertCssValueToString.js";
import emitTypographyDecls from "./emitTypographyDecls.js";

/** @note Mutates `artifact`, calls `outputFile`. */
export default function buildTypography(
  getTransforms: GetTransformsFn,
  resolver: ResolverLike,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  sourceCatalog: SourceCatalog | undefined,
  emittedProperties: EmittedPropertyRegistry,
) {
  const allNodes: CSSNode[] = [];

  // Default product typography → :root.
  const baseTransforms = typographyTransforms(
    getTransforms,
    resolver,
    {},
    sourceCatalog,
  );
  const baseExtensions = resolveTypographyExtensions(
    resolver,
    {},
    sourceCatalog,
  );
  const rootDecls: CSSNode[] = [];
  emitTypographyDependencies(
    resolver,
    rootDecls,
    artifact,
    sourceCatalog,
    emittedProperties,
  );
  const baseTypographyDecls: CSSNode[] = [];
  const seenIds = new Set<string>();

  for (const t of baseTransforms) {
    if (!isSemanticTypography(t.token, t.id, sourceCatalog)) continue;
    if (seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    emitTypographyDecls(
      t,
      baseTypographyDecls,
      artifact,
      "modifiers.typography.css",
      baseExtensions[t.id],
      sourceCatalog?.get(t.id)?.sourceFile,
      emittedProperties,
    );
  }
  rootDecls.push(...baseTypographyDecls);
  allNodes.push(createRule([":root"], rootDecls));

  // Per-product contexts → class selectors. Singular to match the runtime
  // context classes consumers render (`.app` / `.site` / `.docs` / `.os`) — see the
  // density modifier family in @canonical/styles.
  for (const ctx of productContexts(resolver)) {
    const input = productInput(resolver, ctx);
    const contextTransforms = typographyTransforms(
      getTransforms,
      resolver,
      input,
      sourceCatalog,
    );
    const contextExtensions = resolveTypographyExtensions(
      resolver,
      input,
      sourceCatalog,
    );
    const contextDecls: CSSNode[] = [];

    for (const t of contextTransforms) {
      if (!isSemanticTypography(t.token, t.id, sourceCatalog)) continue;
      emitTypographyDecls(
        t,
        contextDecls,
        artifact,
        "modifiers.typography.css",
        contextExtensions[t.id],
        sourceCatalog?.get(t.id)?.sourceFile,
        emittedProperties,
      );
    }
    if (
      contextDecls.length > 0 &&
      declarationSignature(contextDecls) !==
        declarationSignature(baseTypographyDecls)
    ) {
      allNodes.push(createRule([`.${ctx}`], contextDecls));
    }
  }
  const wrapped = wrapInLayer(layers.modifiers, allNodes);
  outputFile(
    "modifiers.typography.css",
    `${HEADER}\n/* Product-context typography; includes its semantic font-family dependencies. */\n${printRules(wrapped)}\n`,
  );
}

function emitTypographyDependencies(
  resolver: ResolverLike,
  decls: CSSNode[],
  artifact: Artifact,
  sourceCatalog: SourceCatalog | undefined,
  emittedProperties: EmittedPropertyRegistry,
): void {
  const tokens = resolver.apply({});
  for (const [id, token] of Object.entries(tokens)) {
    if (
      !id.startsWith("typography.fontFamily.") ||
      classifySourceRole(token, id, sourceCatalog) !== "semantic"
    ) {
      continue;
    }

    const transformed = transformCSSValue(token as never, {
      tokensSet: tokens as never,
      permutation: {},
    });
    const value = convertCssValueToString(
      transformed as string | Record<string, string>,
    );
    if (value === null) {
      throw new Error(
        `[canonical-css] Expected scalar font-family token ${id}`,
      );
    }
    const cssVar = convertTokenIdToCssVar(id);
    emittedProperties.register(cssVar, id);
    decls.push(createDeclaration(cssVar, value));
    const legacy = legacyCssVarForToken(id);
    if (legacy) {
      emittedProperties.register(legacy, `${id}::legacy`);
      decls.push(createDeclaration(legacy, value));
    }
    artifact[cssVar] = makeArtifactToken({
      cssVar,
      id,
      type: token.$type ?? "unknown",
      tier: "semantic",
      visibility: "public",
      cssOutputFile: "modifiers.typography.css",
      description: token.$description,
      extensions: token.$extensions,
      valueLight: value,
      valueDark: value,
      sourceFile: sourceCatalog?.get(id)?.sourceFile ?? token.source?.filename,
    });
  }
}

function declarationSignature(nodes: CSSNode[]): string {
  return JSON.stringify(nodes);
}

/**
 * Include tokens that exist only in a non-default product context. Terrazzo
 * cannot register a transform for an ID absent from its default token set, but
 * the resolver can still supply and resolve that token for the context.
 */
function typographyTransforms(
  getTransforms: GetTransformsFn,
  resolver: ResolverLike,
  input: Record<string, string>,
  sourceCatalog?: SourceCatalog,
): TransformResult[] {
  const transforms = getTransforms({ format: FORMAT, input });
  const seen = new Set(transforms.map(({ id }) => id));
  const applied = resolver.apply(input);

  for (const [id, token] of Object.entries(applied)) {
    if (seen.has(id) || !isSemanticTypography(token, id, sourceCatalog)) {
      continue;
    }
    const transformed = transformCSSValue(token as never, {
      tokensSet: applied as never,
      permutation: input,
    });
    const scalar = convertCssValueToString(
      transformed as string | Record<string, string>,
    );
    transforms.push(
      scalar === null
        ? {
            id,
            type: "MULTI_VALUE",
            value: transformed as Record<string, string>,
            input,
            token,
          }
        : { id, type: "SINGLE_VALUE", value: scalar, input, token },
    );
    seen.add(id);
  }

  return transforms;
}

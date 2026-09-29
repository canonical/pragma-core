/** Build helper for modifiers.spacing.css — unscoped Site defaults plus every product. */
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
import { convertTokenIdToCssVar } from "../../naming.js";
import { isSemanticSpacing } from "../classification.js";
import { FORMAT } from "../constants/format.js";
import { HEADER } from "../constants/header.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import { productContexts, productInput } from "../productAxis.js";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  TransformResult,
} from "../shims.js";
import type { SourceCatalog } from "../sourceCatalog.js";
import convertCssValueToString from "./convertCssValueToString.js";

/** @note Mutates `artifact`, calls `outputFile`. */
export default function buildSpacing(
  getTransforms: GetTransformsFn,
  resolver: ResolverLike,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  sourceCatalog: SourceCatalog | undefined,
  emittedProperties: EmittedPropertyRegistry,
): void {
  const rules: CSSNode[] = [];
  emitContext(":root", {});
  for (const context of productContexts(resolver)) {
    emitContext(`.${context}`, productInput(resolver, context));
  }

  outputFile(
    "modifiers.spacing.css",
    `${HEADER}\n/* Product-context baseline and component spacing. */\n${printRules(
      wrapInLayer(layers.modifiers, rules),
    )}\n`,
  );

  function emitContext(selector: string, input: Record<string, string>): void {
    const declarations: CSSNode[] = [];
    for (const transform of spacingTransforms(
      getTransforms,
      resolver,
      input,
      sourceCatalog,
    )) {
      if (!isSemanticSpacing(transform.token, transform.id, sourceCatalog)) {
        continue;
      }
      if (transform.type !== "SINGLE_VALUE") {
        throw new Error(
          `[canonical-css] Expected scalar spacing token ${transform.id}`,
        );
      }

      const cssVar = convertTokenIdToCssVar(transform.id);
      emittedProperties.register(cssVar, transform.id);
      declarations.push(createDeclaration(cssVar, transform.value));

      if (!(cssVar in artifact)) {
        artifact[cssVar] = makeArtifactToken({
          cssVar,
          id: transform.id,
          type: "dimension",
          tier: "semantic",
          visibility: "public",
          cssOutputFile: "modifiers.spacing.css",
          description: transform.token.$description,
          extensions: transform.token.$extensions,
          valueLight: transform.value,
          valueDark: transform.value,
          sourceFile:
            sourceCatalog?.get(transform.id)?.sourceFile ??
            transform.token.source?.filename,
        });
      }
    }
    rules.push(createRule([selector], declarations));
  }
}

/** Include resolved spacing even when Terrazzo did not register a context transform. */
function spacingTransforms(
  getTransforms: GetTransformsFn,
  resolver: ResolverLike,
  input: Record<string, string>,
  sourceCatalog?: SourceCatalog,
): TransformResult[] {
  const transforms = getTransforms({ format: FORMAT, input });
  const seen = new Set<string>();
  for (const transform of transforms) {
    if (!isSemanticSpacing(transform.token, transform.id, sourceCatalog)) {
      continue;
    }
    if (seen.has(transform.id)) {
      throw new Error(
        `[canonical-css] Duplicate spacing transform ${transform.id}`,
      );
    }
    seen.add(transform.id);
  }
  const applied = resolver.apply(input);

  for (const [id, token] of Object.entries(applied)) {
    if (seen.has(id) || !isSemanticSpacing(token, id, sourceCatalog)) continue;
    const transformed = transformCSSValue(token as never, {
      tokensSet: applied as never,
      permutation: input,
    });
    const scalar = convertCssValueToString(
      transformed as string | Record<string, string>,
    );
    if (scalar === null) {
      throw new Error(`[canonical-css] Expected scalar spacing token ${id}`);
    }
    transforms.push({
      id,
      type: "SINGLE_VALUE",
      value: scalar,
      input,
      token,
    });
    seen.add(id);
  }

  return transforms;
}

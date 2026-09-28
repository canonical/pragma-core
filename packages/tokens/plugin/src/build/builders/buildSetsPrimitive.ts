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
import { isPrimitive } from "../classification.js";
import { FORMAT } from "../constants/format.js";
import { HEADER } from "../constants/header.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { GetTransformsFn, OutputFileFn } from "../shims.js";
import type { SourceCatalog } from "../sourceCatalog.js";

/** @note Mutates `artifact`, calls `outputFile`. */
export default function buildSetsPrimitive(
  getTransforms: GetTransformsFn,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  sourceCatalog: SourceCatalog | undefined,
  emittedProperties: EmittedPropertyRegistry,
) {
  const transforms = getTransforms({ format: FORMAT });
  const nodes: CSSNode[] = [];

  for (const t of transforms) {
    if (!isPrimitive(t.token, t.id, sourceCatalog)) continue;
    // Skip dark / per-product permutations — only use the base
    if (
      t.input &&
      Object.keys(t.input).some((k) => k === "theme" && t.input[k] !== "light")
    )
      continue;
    if (t.input && "product" in t.input && t.input.product !== "global")
      continue;
    if (t.input && "typography" in t.input && t.input.typography !== "global")
      continue;

    const cssVar = convertTokenIdToCssVar(t.id);
    if (t.type === "SINGLE_VALUE") {
      emittedProperties.register(cssVar, t.id);
      nodes.push(createDeclaration(cssVar, t.value));
      const legacy = legacyCssVarForToken(t.id);
      if (legacy) {
        emittedProperties.register(legacy, `${t.id}::legacy`);
        nodes.push(createDeclaration(legacy, t.value));
      }
      artifact[cssVar] = makeArtifactToken({
        cssVar,
        id: t.id,
        type: t.token.$type ?? "unknown",
        tier: "primitive",
        visibility: "public",
        cssOutputFile: "sets.primitive.css",
        description: t.token.$description,
        extensions: t.token.$extensions,
        valueLight: t.value,
        valueDark: t.value,
        sourceFile:
          sourceCatalog?.get(t.id)?.sourceFile ?? t.token.source?.filename,
      });
    } else {
      // Multi-value — emit each sub-property
      for (const [suffix, val] of Object.entries(t.value)) {
        const subVar = `${cssVar}-${suffix}`;
        emittedProperties.register(subVar, `${t.id}/${suffix}`);
        nodes.push(createDeclaration(subVar, val));
        const legacyBase = legacyCssVarForToken(t.id);
        if (legacyBase) {
          const legacy = `${legacyBase}-${suffix}`;
          emittedProperties.register(legacy, `${t.id}/${suffix}::legacy`);
          nodes.push(createDeclaration(legacy, val));
        }
        artifact[subVar] = makeArtifactToken({
          cssVar: subVar,
          id: `${t.id}.${suffix}`,
          type: t.token.$type ?? "unknown",
          tier: "primitive",
          visibility: "public",
          cssOutputFile: "sets.primitive.css",
          description: t.token.$description,
          extensions: t.token.$extensions,
          valueLight: val,
          valueDark: val,
          sourceFile:
            sourceCatalog?.get(t.id)?.sourceFile ?? t.token.source?.filename,
        });
      }
    }
  }

  const wrapped = wrapInLayer(layers.tokens, [createRule([":root"], nodes)]);
  outputFile("sets.primitive.css", `${HEADER}\n${printRules(wrapped)}\n`);
}

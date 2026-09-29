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
import { classifySourceRole, isSemanticSpacing } from "../classification.js";
import { FORMAT } from "../constants/format.js";
import { HEADER } from "../constants/header.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { GetTransformsFn, OutputFileFn } from "../shims.js";
import type { SourceCatalog } from "../sourceCatalog.js";

/** Emit mode-invariant semantic tokens not owned by a dedicated builder. */
export default function buildSetsSemantic(
  getTransforms: GetTransformsFn,
  layers: ResolvedLayerConfig,
  artifact: Artifact,
  outputFile: OutputFileFn,
  sourceCatalog: SourceCatalog | undefined,
  emittedProperties: EmittedPropertyRegistry,
) {
  const nodes: CSSNode[] = [];
  const seen = new Set<string>();

  for (const transform of getTransforms({ format: FORMAT })) {
    if (seen.has(transform.id)) continue;
    if (
      classifySourceRole(transform.token, transform.id, sourceCatalog) !==
        "semantic" ||
      transform.token.$type === "color" ||
      transform.token.$type === "typography" ||
      isSemanticSpacing(transform.token, transform.id, sourceCatalog) ||
      transform.id.startsWith("typography.fontFamily.")
    ) {
      continue;
    }
    seen.add(transform.id);

    const cssVar = convertTokenIdToCssVar(transform.id);
    const sourceFile =
      sourceCatalog?.get(transform.id)?.sourceFile ??
      transform.token.source?.filename;
    if (transform.type === "SINGLE_VALUE") {
      emittedProperties.register(cssVar, transform.id);
      nodes.push(createDeclaration(cssVar, transform.value));
      emitCompatibilityAlias(transform.id, transform.value);
      addArtifact(cssVar, transform.id, transform.value);
    } else {
      for (const [suffix, value] of Object.entries(transform.value)) {
        const subVar = `${cssVar}-${suffix}`;
        emittedProperties.register(subVar, `${transform.id}/${suffix}`);
        nodes.push(createDeclaration(subVar, value));
        const legacyBase = legacyCssVarForToken(transform.id);
        if (legacyBase) {
          const legacy = `${legacyBase}-${suffix}`;
          emittedProperties.register(
            legacy,
            `${transform.id}/${suffix}::legacy`,
          );
          nodes.push(createDeclaration(legacy, value));
        }
        addArtifact(subVar, `${transform.id}.${suffix}`, value);
      }
    }

    function addArtifact(property: string, id: string, value: string): void {
      artifact[property] = makeArtifactToken({
        cssVar: property,
        id,
        type: transform.token.$type ?? "unknown",
        tier: "semantic",
        visibility: "public",
        cssOutputFile: "sets.semantic.css",
        description: transform.token.$description,
        extensions: transform.token.$extensions,
        valueLight: value,
        valueDark: value,
        sourceFile,
      });
    }

    function emitCompatibilityAlias(id: string, value: string): void {
      const legacy = legacyCssVarForToken(id);
      if (legacy) {
        emittedProperties.register(legacy, `${id}::legacy`);
        nodes.push(createDeclaration(legacy, value));
      }
    }
  }

  const rules = nodes.length > 0 ? [createRule([":root"], nodes)] : [];
  const wrapped = wrapInLayer(layers.tokens, rules);
  outputFile("sets.semantic.css", `${HEADER}\n${printRules(wrapped)}\n`);
}

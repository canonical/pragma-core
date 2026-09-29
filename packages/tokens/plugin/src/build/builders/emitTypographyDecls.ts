import { makeArtifactToken } from "../../artifact/index.js";
import type { Artifact } from "../../artifact/types.js";
import { createDeclaration } from "../../css-ast/index.js";
import type { CSSNode } from "../../css-ast/types.js";
import { convertTokenIdToCssVar, legacyCssVarForToken } from "../../naming.js";
import type EmittedPropertyRegistry from "../emittedPropertyRegistry.js";
import type { TransformResult } from "../shims.js";
import { typographyExtensionDecls } from "../typographyExtensions.js";

export default function emitTypographyDecls(
  t: TransformResult,
  decls: CSSNode[],
  artifact: Artifact,
  outputFile: string,
  resolvedExtensions: Record<string, unknown> | undefined,
  sourceFile: string | undefined,
  emittedProperties: EmittedPropertyRegistry,
) {
  const cssVar = convertTokenIdToCssVar(t.id);
  if (t.type === "SINGLE_VALUE") {
    emittedProperties.register(cssVar, t.id);
    decls.push(createDeclaration(cssVar, t.value));
    // First write wins: the default-product (:root) pass runs before explicit
    // product contexts, so the artifact keeps its root value instead of being overwritten by
    // whichever context (.app/.docs/.site) is emitted last.
    if (!(cssVar in artifact)) {
      artifact[cssVar] = makeArtifactToken({
        cssVar,
        id: t.id,
        type: t.token.$type ?? "unknown",
        tier: "semantic",
        visibility: "public",
        cssOutputFile: outputFile,
        description: t.token.$description,
        extensions: resolvedExtensions ?? t.token.$extensions,
        valueLight: t.value,
        valueDark: t.value,
        sourceFile: sourceFile ?? t.token.source?.filename,
      });
    }
    emitCompatibilityAlias(t.id, t.value, decls, emittedProperties);
  } else {
    // Multi-value: typography composite → individual sub-properties. The
    // standard sub-keys (font-family, font-size, …) come from Terrazzo's
    // flattened `$value`; the canonical `$extensions` add `font-variant` /
    // `font-variant-numeric` (small-caps, old-style figures), which Terrazzo
    // does not model and would otherwise be dropped (see typographyExtensions).
    const subProps: Record<string, string> = {
      ...t.value,
      ...typographyExtensionDecls(resolvedExtensions ?? t.token.$extensions),
    };
    for (const [suffix, val] of Object.entries(subProps)) {
      const subVar = `${cssVar}-${suffix}`;
      emittedProperties.register(subVar, `${t.id}/${suffix}`);
      decls.push(createDeclaration(subVar, val));
      const legacyBase = legacyCssVarForToken(t.id);
      if (legacyBase) {
        const legacy = `${legacyBase}-${suffix}`;
        emittedProperties.register(legacy, `${t.id}/${suffix}::legacy`);
        decls.push(createDeclaration(legacy, val));
      }
      if (!(subVar in artifact)) {
        artifact[subVar] = makeArtifactToken({
          cssVar: subVar,
          id: `${t.id}.${suffix}`,
          type: t.token.$type ?? "unknown",
          tier: "semantic",
          visibility: "public",
          cssOutputFile: outputFile,
          description: t.token.$description,
          extensions: resolvedExtensions ?? t.token.$extensions,
          valueLight: val,
          valueDark: val,
          sourceFile: sourceFile ?? t.token.source?.filename,
        });
      }
    }
  }
}

function emitCompatibilityAlias(
  id: string,
  value: string,
  decls: CSSNode[],
  emittedProperties: EmittedPropertyRegistry,
): void {
  const legacy = legacyCssVarForToken(id);
  if (legacy) {
    emittedProperties.register(legacy, `${id}::legacy`);
    decls.push(createDeclaration(legacy, value));
  }
}

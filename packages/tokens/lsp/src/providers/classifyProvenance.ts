/**
 * Classify where a CSS custom property came from so UI features can explain it
 * consistently.
 *
 * The precedence is intentional: artifact tokens win over `@property`, which
 * wins over scanned declarations. That keeps completions, hovers, and semantic
 * tokens aligned with the most authoritative source available.
 */
import type { TokenGraph } from "../graph/index.js";
import type { TokenProvenance } from "../types/index.js";

/** Classify the provenance of a CSS custom property. */
export default function classifyProvenance(
  cssVar: string,
  graph: TokenGraph,
  fileUri: string,
): TokenProvenance {
  const token = graph.resolveToken(cssVar);
  if (token?.provenance.kind === "artifact") return token.provenance;
  const prop = graph.getProperty(cssVar);
  if (prop) return { kind: "property", fileUri: prop.fileUri };
  const decls = graph.getDeclarations(cssVar);
  const decl = decls?.[0];
  if (decl) {
    const file = graph.getFile(decl.fileUri);
    if (file?.isExternal)
      return { kind: "external", packageName: file.packageName ?? "unknown" };
    return { kind: "local", fileUri: decl.fileUri };
  }
  return { kind: "local", fileUri };
}

import type { TokenGraph } from "../graph/index.js";
import type { Location } from "../types/index.js";

/**
 * Provide reference locations for a CSS custom property.
 *
 * Returns usage sites and declaration sites merged into a single
 * location list, suitable for the LSP `textDocument/references` response.
 */
export default function provideReferences(
  cssVar: string,
  graph: TokenGraph,
): Location[] {
  const locations: Location[] = [];

  // Usage sites: var(--x)
  const usages = graph.getUsages(cssVar);
  for (const usage of usages) {
    locations.push({
      uri: usage.fileUri,
      range: {
        start: { line: usage.line, character: usage.column },
        end: {
          line: usage.line,
          character:
            usage.column + "var(".length + usage.cssVar.length + ")".length,
        },
      },
    });
  }

  // Declaration sites: --x: value
  const declarations = graph.getDeclarations(cssVar);
  for (const decl of declarations) {
    locations.push({
      uri: decl.fileUri,
      range: {
        start: { line: decl.line, character: decl.column },
        end: {
          line: decl.line,
          character: decl.column + decl.cssVar.length,
        },
      },
    });
  }

  return locations;
}

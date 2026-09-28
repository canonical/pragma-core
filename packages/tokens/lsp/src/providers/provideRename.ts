/**
 * Rename-with-cascade provider.
 *
 * Renames a CSS custom property across all usage, declaration, and
 * @property sites in the workspace graph. For artifact-provenance tokens,
 * sets `requiresRebuild: true` to indicate a Terrazzo rebuild is needed.
 *
 */
import type { TokenGraph } from "../graph/index.js";
import type { RenameResult, TextEdit } from "../types/index.js";

/**
 * Produce a workspace edit that renames a CSS custom property.
 *
 * Returns `null` if the variable is not known in the graph.
 */
export default function provideRename(
  cssVar: string,
  newName: string,
  graph: TokenGraph,
): RenameResult | null {
  const token = graph.resolveToken(cssVar);
  const decls = graph.getDeclarations(cssVar);
  const prop = graph.getProperty(cssVar);
  const usages = graph.getUsages(cssVar);

  // Must exist somewhere in the graph
  if (!token && decls.length === 0 && !prop && usages.length === 0) {
    return null;
  }

  const changes: Record<string, TextEdit[]> = {};
  const requiresRebuild = token?.provenance.kind === "artifact";

  // Collect edits per file

  // 1. Declaration sites
  for (const decl of decls) {
    addEdit(changes, decl.fileUri, {
      range: {
        start: { line: decl.line, character: decl.column },
        end: { line: decl.line, character: decl.column + cssVar.length },
      },
      newText: newName,
    });
  }

  // 2. @property registration
  if (prop) {
    addEdit(changes, prop.fileUri, {
      range: {
        start: { line: prop.line, character: 0 },
        end: { line: prop.line, character: cssVar.length },
      },
      newText: newName,
    });
  }

  // 3. Usage sites (var(--x) references)
  // Edit only the `--name` token, not the enclosing `var(` call — the
  // usage's `column` points at `var(`, so the name range must use the
  // dedicated `varNameColumn`/`varNameLength` fields.
  for (const usage of usages) {
    addEdit(changes, usage.fileUri, {
      range: {
        start: { line: usage.line, character: usage.varNameColumn },
        end: {
          line: usage.line,
          character: usage.varNameColumn + usage.varNameLength,
        },
      },
      newText: newName,
    });
  }

  return {
    edit: { changes },
    requiresRebuild,
  };
}

/** Append a text edit to the changes map for a given file URI. */
function addEdit(
  changes: Record<string, TextEdit[]>,
  uri: string,
  edit: TextEdit,
): void {
  const existing = changes[uri];
  if (existing) {
    existing.push(edit);
  } else {
    changes[uri] = [edit];
  }
}

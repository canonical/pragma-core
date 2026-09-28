/**
 * Build the import graph via BFS from an open file URI.
 *
 * Reads files from disk, extracts `@import` and JS CSS import statements,
 * resolves import specifiers, and populates the TokenGraph with FileNodes,
 * import edges, and scanned declarations/properties.
 *
 * @note This function is impure — it reads from the file system.
 *
 */
import {
  extractPackageName,
  isExternalPath,
  parseFileUri,
} from "../css/imports/index.js";
import type { Tree } from "../css/lezer/index.js";
import * as lezer from "../css/lezer/index.js";
import type { TokenGraph } from "../graph/index.js";
import indexDocument from "./indexing/indexDocument.js";
import type { FileSystem } from "./types.js";

/**
 * Perform a BFS traversal from a root URI, building the import graph
 * and scanning all reachable files for declarations, properties, and usages.
 *
 * @note This function is impure — it reads files via the `fs` abstraction.
 */
export default async function buildImportGraph(
  rootUri: string,
  graph: TokenGraph,
  fs: FileSystem,
  sourceOverrides?: ReadonlyMap<string, string>,
  treeOverrides?: ReadonlyMap<string, Tree>,
): Promise<void> {
  const visited = new Set<string>();
  const queue: string[] = [rootUri];

  while (queue.length > 0) {
    const uri = queue.shift() as string;
    if (visited.has(uri)) continue;
    visited.add(uri);

    const source = sourceOverrides?.get(uri) ?? (await fs.readFile(uri));
    if (source === null) continue;
    const tree = treeOverrides?.get(uri) ?? lezer.parseCSS(source);

    ensureFileNode(uri, graph);
    const imports = indexDocument({
      fileUri: uri,
      graph,
      rootDir: fs.rootDir,
      source,
      tree,
    });
    for (const importedUri of imports) {
      ensureFileNode(importedUri, graph);
      if (!visited.has(importedUri)) {
        queue.push(importedUri);
      }
    }
  }
}

/** Ensure a FileNode exists in the graph for a given URI. */
function ensureFileNode(uri: string, graph: TokenGraph): void {
  if (graph.hasFile(uri)) return;
  const path = parseFileUri(uri);
  const external = isExternalPath(path);
  graph.addFile({
    uri,
    path,
    isExternal: external,
    packageName: external ? extractPackageName(path) : null,
  });
}

/**
 * `graph` command — show the import graph from a file.
 *
 * @note Impure — reads files, writes to stdout/stderr, may exit the process.
 */
import * as fs from "node:fs/promises";
import { resolve } from "node:path";
import { TokenGraph } from "../graph/index.js";
import buildImportGraph from "../runtime/buildImportGraph.js";
import type { FileSystem } from "../runtime/types.js";

export async function runGraph(
  file: string | undefined,
  rootDir: string,
): Promise<void> {
  if (!file) {
    console.error("Usage: terrazzo-lsp graph <file>");
    process.exit(1);
  }
  const graph = new TokenGraph();
  const absPath = resolve(rootDir, file);
  const uri = `file://${absPath}`;

  const nodeFs: FileSystem = {
    rootDir,
    async readFile(fileUri: string): Promise<string | null> {
      const fsPath = fileUri.startsWith("file://") ? fileUri.slice(7) : fileUri;
      try {
        return await fs.readFile(fsPath, "utf-8");
      } catch {
        return null;
      }
    },
  };

  await buildImportGraph(uri, graph, nodeFs);

  console.log(`Import graph from ${file}:`);
  for (const [importer, imported] of graph.importEntries()) {
    for (const dep of imported) {
      const short = (s: string) =>
        s.startsWith("file://") ? s.slice(7).replace(rootDir, ".") : s;
      console.log(`  ${short(importer)} → ${short(dep)}`);
    }
  }
  console.log(`\nFiles: ${graph.fileCount}`);
  console.log(`Declarations: ${graph.varCount}`);
}

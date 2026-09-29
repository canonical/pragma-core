/**
 * Index a single CSS document into the token graph.
 */
import createDocumentIndex from "../../css/createDocumentIndex.js";
import type { Tree } from "../../css/lezer/index.js";
import type { TokenGraph } from "../../graph/index.js";
import updateImportEdges from "./updateImportEdges.js";

interface IndexDocumentOptions {
  fileUri: string;
  graph: TokenGraph;
  rootDir?: string;
  source: string;
  tree: Tree;
}

export default function indexDocument(options: IndexDocumentOptions): string[] {
  const { fileUri, graph, rootDir, source, tree } = options;
  const documentIndex = createDocumentIndex({
    fileUri,
    rootDir,
    source,
    tree,
  });

  graph.addFile(documentIndex.file);
  graph.clearFile(fileUri);
  updateImportEdges({
    graph,
    importedUris: documentIndex.importedUris,
    importerUri: fileUri,
  });

  for (const declaration of documentIndex.declarations) {
    graph.addDeclaration(declaration);
  }

  for (const property of documentIndex.properties) {
    graph.addProperty(property);
  }

  for (const usage of documentIndex.usages) {
    graph.addUsage(usage);
  }

  return documentIndex.importedUris;
}

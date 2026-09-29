/**
 * Create the full index payload for a CSS document.
 */
import type {
  DeclarationNode,
  FileNode,
  PropertyNode,
  UsageNode,
} from "../types/index.js";
import extractCssImports from "./imports/extractCssImports.js";
import extractJsImports from "./imports/extractJsImports.js";
import extractPackageName from "./imports/extractPackageName.js";
import formatFileUri from "./imports/formatFileUri.js";
import isExternalPath from "./imports/isExternalPath.js";
import parseFileUri from "./imports/parseFileUri.js";
import resolveImportSpecifier from "./imports/resolveImportSpecifier.js";
import type { Tree } from "./lezer/index.js";
import scanDeclarations from "./scanners/scanDeclarations.js";
import scanProperties from "./scanners/scanProperties.js";
import scanUsages from "./scanners/scanUsages.js";

interface CreateDocumentIndexOptions {
  fileUri: string;
  source: string;
  tree: Tree;
  rootDir?: string;
}

interface DocumentIndex {
  declarations: DeclarationNode[];
  file: FileNode;
  importedUris: string[];
  properties: PropertyNode[];
  usages: UsageNode[];
}

export default function createDocumentIndex(
  options: CreateDocumentIndexOptions,
): DocumentIndex {
  const { fileUri, rootDir, source, tree } = options;
  const path = parseFileUri(fileUri);

  return {
    declarations: scanDeclarations(source, fileUri, tree),
    file: {
      uri: fileUri,
      path,
      isExternal: isExternalPath(path),
      packageName: isExternalPath(path) ? extractPackageName(path) : null,
    },
    importedUris: rootDir
      ? resolveImportedUris(source, tree, path, rootDir)
      : [],
    properties: scanProperties(source, fileUri, tree),
    usages: scanUsages(source, fileUri, tree),
  };
}

function resolveImportedUris(
  source: string,
  tree: Tree,
  importerPath: string,
  rootDir: string,
): string[] {
  const importedUris = new Set<string>();
  const specifiers = [
    ...extractCssImports(source, tree),
    ...extractJsImports(source),
  ];

  for (const specifier of specifiers) {
    const resolvedPath = resolveImportSpecifier(
      specifier,
      importerPath,
      rootDir,
    );
    if (resolvedPath) {
      importedUris.add(formatFileUri(resolvedPath));
    }
  }

  return [...importedUris];
}

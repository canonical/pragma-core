import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { GraphStore, PrefixMap } from "../graph/index.js";
import serializeToTurtle from "../serializers/TTLSerializer.js";
import resolvePublicExports, { importNameFor } from "./resolvePublicExports.js";
import type { CollectConfig, ImplementsAnnotation } from "./types.js";

/** Standard RDF/OWL namespaces - these are always included */
const STANDARD_PREFIXES: Record<string, string> = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

/** Reserved prefixes that cannot be overridden by user config */
const RESERVED_PREFIXES = new Set(["rdf", "rdfs", "xsd", "owl"]);

/**
 * Generate a slug from a string for URI
 * e.g., "Pragma React" -> "pragma-react"
 * e.g., "src/lib/Button/Button.tsx" -> "src-lib-button-button-tsx"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/^@[^/]+\//, "") // Remove npm scope
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a unique slug from a file path for URI
 * Uses parent directory context to disambiguate common file names
 * e.g., "src/lib/Button/Button.tsx" -> "button"
 * e.g., "src/lib/Tile/common/Header/Header.tsx" -> "tile-header"
 * e.g., "src/lib/Accordion/common/Item/Item.tsx" -> "accordion-item"
 */
function filePathSlug(filePath: string): string {
  // Remove extension and get path parts
  const withoutExt = filePath.replace(/\.[^.]+$/, "");
  const parts = withoutExt.split("/").filter(Boolean);

  // Skip common non-meaningful directory names
  const skipDirs = new Set(["src", "lib", "common", "components", "index"]);

  // Find meaningful parts (component names, not common dirs)
  const meaningful: string[] = [];
  for (const part of parts) {
    if (!skipDirs.has(part.toLowerCase())) {
      meaningful.push(part);
    }
  }

  // Deduplicate consecutive identical names (Button/Button.tsx -> [Button])
  // This handles cases like Tile/common/Content/Content.tsx -> [Tile, Content]
  const deduped: string[] = [];
  for (const part of meaningful) {
    if (
      deduped.length === 0 ||
      deduped[deduped.length - 1].toLowerCase() !== part.toLowerCase()
    ) {
      deduped.push(part);
    }
  }

  // If only one meaningful part (e.g., Button/Button.tsx -> [Button])
  if (deduped.length === 1) {
    return slugify(deduped[0]);
  }

  // Multiple parts: combine main component with last part
  // Tile/common/Content/Content.tsx -> [Tile, Content] -> tile-content
  // Timeline/common/Content/Content.tsx -> [Timeline, Content] -> timeline-content
  if (deduped.length >= 2) {
    const mainComponent = deduped[0];
    const lastPart = deduped[deduped.length - 1];
    return slugify(`${mainComponent}-${lastPart}`);
  }

  // Fallback: just use the last meaningful part
  return slugify(meaningful[meaningful.length - 1] || "unknown");
}

/**
 * Build a PrefixMap with standard prefixes and user's data prefix
 * Validates that user prefix doesn't conflict with reserved prefixes
 */
function buildPrefixMap(config: CollectConfig): PrefixMap {
  const prefixes = new PrefixMap();

  // Add standard prefixes
  for (const [prefix, namespace] of Object.entries(STANDARD_PREFIXES)) {
    prefixes.add(prefix, namespace);
  }

  // Validate and add user's data prefix
  if (RESERVED_PREFIXES.has(config.prefix.short)) {
    throw new Error(
      `Prefix "${config.prefix.short}" is reserved. Use a different prefix for your data namespace.`,
    );
  }
  prefixes.add(config.prefix.short, config.prefix.namespace);

  return prefixes;
}

/**
 * Generate the ImplementationLibrary .ttl content
 */
export function generateLibraryTurtle(config: CollectConfig): Promise<string> {
  const store = new GraphStore();
  const prefixes = buildPrefixMap(config);
  const p = config.prefix.short;

  // Library URI
  const librarySlug = slugify(config.name);
  const libraryUri = `${config.prefix.namespace}implementation.library.${librarySlug}`;

  // Add type
  store.addQuad(
    libraryUri,
    prefixes.expand("rdf:type"),
    prefixes.expand(`${p}:ImplementationLibrary`),
  );

  // Add required properties
  store.addLiteral(
    libraryUri,
    prefixes.expand(`${p}:libraryName`),
    config.name,
  );
  store.addLiteral(
    libraryUri,
    prefixes.expand(`${p}:platform`),
    config.platform,
  );
  store.addLiteral(libraryUri, prefixes.expand(`${p}:link`), config.link);

  // Add optional properties
  if (config.description) {
    store.addLiteral(
      libraryUri,
      prefixes.expand(`${p}:summary`),
      config.description,
    );
  }

  if (config.documentation) {
    store.addLiteral(
      libraryUri,
      prefixes.expand(`${p}:documentation`),
      config.documentation,
    );
  }

  if (config.tier) {
    store.addQuad(
      libraryUri,
      prefixes.expand(`${p}:libraryTier`),
      prefixes.expand(config.tier),
    );
  }

  if (config.version) {
    store.addLiteral(
      libraryUri,
      prefixes.expand(`${p}:version`),
      config.version,
    );
  }

  return serializeToTurtle(store, { prefixes });
}

/**
 * Build the source link for an implementation file.
 * With a repository configured, returns a full blob URL pinned to the given
 * ref; otherwise falls back to the repo-relative path.
 */
function buildSourceLink(
  config: CollectConfig,
  ref: string,
  relativePath: string,
): string {
  if (!config.repository) {
    return relativePath;
  }
  const repo = config.repository.replace(/\/$/, "");
  const prefix = config.sourcePath ? `${config.sourcePath}/` : "";
  return `${repo}/blob/${ref}/${prefix}${relativePath}`;
}

/**
 * Conventional public entry modules, tried in order when config names none.
 *
 * Two conventions live side by side in one monorepo: a bundler package puts its
 * barrel at `src/index.ts`, a SvelteKit library at `src/lib/index.ts`. Trying
 * both means neither kind needs to configure anything; `entry` stays available
 * for a package that does neither.
 */
const DEFAULT_ENTRY_FILES = [
  "src/index.ts",
  "src/index.tsx",
  "src/lib/index.ts",
];

/**
 * The entry module to walk exports from — the configured one, or the first
 * conventional path that exists. Falls back to the first candidate so a package
 * with no barrel at all resolves to a missing file, which yields no exports and
 * therefore no import statements.
 */
function resolveEntryFile(config: CollectConfig, basePath: string): string {
  if (config.entry) {
    return join(basePath, config.entry);
  }
  const found = DEFAULT_ENTRY_FILES.map((candidate) =>
    join(basePath, candidate),
  ).find((candidate) => existsSync(candidate));
  return found ?? join(basePath, DEFAULT_ENTRY_FILES[0]);
}

/**
 * The import statement a consumer pastes to reach this implementation.
 *
 * Built from the PUBLISHED package specifier and the name the package's barrel
 * chain actually exports the file under — never from the file name, which is
 * routinely not the exported name. Returns undefined when the file is not
 * publicly exported, and the caller then emits no statement: a reader who sees
 * no import learns something true, where a guessed one would send them to a
 * symbol that does not exist.
 */
function buildImportStatement(packageName: string, exportName: string): string {
  return `import { ${exportName} } from "${packageName}";`;
}

/**
 * Generate the ImplementationObject .ttl content from annotations
 * ImplementationObjects are named IRIs (ds:implementation.{librarySlug}.{blockLocalName})
 * attached to the library, so they keep a stable identity across releases
 * when ingested into a knowledge graph.
 */
export async function generateObjectsTurtle(
  config: CollectConfig,
  annotations: ImplementsAnnotation[],
  basePath: string,
): Promise<string> {
  if (annotations.length === 0) {
    return "";
  }

  const store = new GraphStore();
  const prefixes = buildPrefixMap(config);
  const p = config.prefix.short;

  const librarySlug = slugify(config.name);
  const libraryUri = `${config.prefix.namespace}implementation.library.${librarySlug}`;

  // What the package publishes, and under which names. Resolved once per
  // library: the barrel walk is shared by every annotation below.
  const publicExports = await resolvePublicExports(
    resolveEntryFile(config, basePath),
  );

  // Sort for deterministic output so regenerated files diff cleanly
  const sorted = [...annotations].sort((a, b) => {
    const byBlock = a.blockUri.localeCompare(b.blockUri);
    return byBlock !== 0 ? byBlock : a.filePath.localeCompare(b.filePath);
  });

  // Track emitted IRIs so a second implementation of the same block in the
  // same library gets a file-path discriminator instead of merging silently
  const seen = new Set<string>();

  for (const annotation of sorted) {
    const relativePath = relative(basePath, annotation.filePath);

    // Named IRI: ds:implementation.{librarySlug}.{blockLocalName}
    const blockLocalName = annotation.blockUri.replace(/^[^:]+:/, "");
    let implUri = `${config.prefix.namespace}implementation.${librarySlug}.${blockLocalName}`;
    if (seen.has(implUri)) {
      implUri = `${implUri}.${filePathSlug(relativePath)}`;
    }
    seen.add(implUri);

    // Link library to implementation object
    store.addQuad(
      libraryUri,
      prefixes.expand(`${p}:hasImplementation`),
      implUri,
    );

    // Add type
    store.addQuad(
      implUri,
      prefixes.expand("rdf:type"),
      prefixes.expand(`${p}:ImplementationObject`),
    );

    // Add implements block reference
    store.addQuad(
      implUri,
      prefixes.expand(`${p}:implementsBlock`),
      prefixes.expand(annotation.blockUri),
    );

    // Add head link (source file at the repository head)
    store.addLiteral(
      implUri,
      prefixes.expand(`${p}:headLink`),
      buildSourceLink(config, "main", relativePath),
    );

    // Add the import statement, when the file is publicly exported
    const exportName = importNameFor(publicExports, annotation.filePath);
    if (exportName) {
      store.addLiteral(
        implUri,
        prefixes.expand(`${p}:importStatement`),
        buildImportStatement(config.name, exportName),
      );
    }

    // Add versioned link (source file pinned to the release tag)
    if (config.repository && config.version) {
      store.addLiteral(
        implUri,
        prefixes.expand(`${p}:versionedLink`),
        buildSourceLink(config, `v${config.version}`, relativePath),
      );
    }

    // Add version if specified
    if (annotation.version) {
      store.addLiteral(
        implUri,
        prefixes.expand(`${p}:implementationVersion`),
        annotation.version,
      );
    }

    // Add draft status if true
    if (annotation.isDraft) {
      store.addLiteral(implUri, prefixes.expand(`${p}:isDraft`), "true");
    }
  }

  return serializeToTurtle(store, { prefixes });
}

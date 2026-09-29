import type { Dirent } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../config/types.js";
import type { GraphStore, PrefixMap } from "../graph/index.js";
import { serializeToJsonLd, serializeToTurtle } from "../serializers/index.js";
import guardTokenBindings from "../transform/bindingGuard.js";
import collectDataMetrics from "../transform/collectDataMetrics.js";
import {
  ALLOW_MALFORMED_ROWS_ENV_VAR,
  ALLOW_SHRINK_ENV_VAR,
  assertNoMalformedRows,
  assertNoUnclassifiableRows,
  assertNoUnexpectedShrink,
  assertTablesYieldSubjects,
} from "../transform/deltaGuards.js";
import materializeInverses from "../transform/materializeInverses.js";
import reportFilteredRows from "../transform/reportFilteredRows.js";
import deriveTokenBindings, {
  BINDING_PREFIXES,
} from "../transform/tokenBindings.js";
import transformData from "../transform/transform.js";

// Ontology document declaring the owl:inverseOf pairs to materialize.
const ONTOLOGY_PATH = "definitions/ontology.ttl";

/**
 * Extracted data structure from the extract command
 */
interface ExtractedData {
  document: string;
  extractedAt: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

/**
 * Load extracted data from file
 */
async function loadExtractedData(inputPath: string): Promise<ExtractedData> {
  const content = await readFile(inputPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Parse URI into path components for file organization
 *
 * Splits dot-separated URI path into folder structure:
 * "https://ds.canonical.com/global.component.button" -> ["global", "component", "button"]
 *
 * Returns array of path parts, or null if URI doesn't match expected format
 */
function parseUri(uri: string): string[] | null {
  const dsNamespace = "https://ds.canonical.com/";

  if (!uri.startsWith(dsNamespace)) {
    return null;
  }

  const path = uri.slice(dsNamespace.length);
  const parts = path.split(".");

  // Reject URIs with empty segments (e.g. double dots from unresolved templates)
  if (parts.some((p) => p === "")) {
    return null;
  }

  return parts.length > 0 ? parts : null;
}

/**
 * Remove all generated RDF files from the output directory tree.
 * Called before writing new output to avoid stale files accumulating.
 */
async function cleanOutputDir(outputDir: string, ext: string): Promise<void> {
  let entries: Dirent[];
  try {
    entries = (await readdir(outputDir, {
      withFileTypes: true,
      recursive: true,
    })) as Dirent[];
  } catch {
    return; // Directory doesn't exist yet
  }
  await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.endsWith(`.${ext}`))
      .map((e) => rm(join(e.parentPath, e.name), { force: true })),
  );
}

/**
 * Serialize the transformed graph into `targetDir`.
 *
 * Extracted from transform() so the new dataset can be staged in a temp
 * directory and validated against the committed one before any destructive
 * write (see the delta guards in transform()).
 */
async function writeDataset(
  targetDir: string,
  transformConfig: NonNullable<Config["transform"]>,
  store: GraphStore,
  prefixes: PrefixMap,
  subjects: string[],
  ext: string,
): Promise<void> {
  const isTurtle = ext === "ttl";

  if (transformConfig.atomicity === "class") {
    // One file per table - serialize all subjects together
    const content = isTurtle
      ? await serializeToTurtle(store, { prefixes })
      : JSON.stringify(await serializeToJsonLd(store, { prefixes }), null, 2);

    await writeFile(join(targetDir, `all.${ext}`), content);
    return;
  }

  // One file per instance, organized by URI structure
  for (const subjectUri of subjects) {
    const parts = parseUri(subjectUri);

    let outputDir: string;
    let filename: string;

    if (parts && parts.length > 1) {
      // Use all parts except the last as directory path, last part as filename
      const dirParts = parts.slice(0, -1);
      filename = parts[parts.length - 1];
      outputDir = join(targetDir, ...dirParts);
    } else if (parts && parts.length === 1) {
      // Single part - put in root output dir
      outputDir = targetDir;
      filename = parts[0];
    } else {
      // Fallback for URIs that don't match expected format
      outputDir = targetDir;
      const lastSlash = subjectUri.lastIndexOf("/");
      const path =
        lastSlash !== -1 ? subjectUri.slice(lastSlash + 1) : subjectUri;
      const colonIdx = path.indexOf(":");
      filename = colonIdx !== -1 ? path.slice(colonIdx + 1) : path;
      filename = filename.replace(/[^a-z0-9.\-_]/gi, "_");
    }

    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, `${filename}.${ext}`);

    // Create a new store with just this subject's quads
    const subjectQuads = store.getQuadsForSubject(subjectUri);
    const { GraphStore } = await import("../graph/index.js");
    const subjectStore = new GraphStore();
    for (const quad of subjectQuads) {
      // Re-add using full URIs since we extracted them from the original store
      subjectStore.getN3Store().addQuad(quad);
    }

    const content = isTurtle
      ? await serializeToTurtle(subjectStore, { prefixes })
      : JSON.stringify(
          await serializeToJsonLd(subjectStore, {
            prefixes,
            subject: subjectUri,
          }),
          null,
          2,
        );

    await writeFile(outputPath, content);
  }
}

/**
 * Transforms extracted data into RDF and serializes to files.
 *
 * Fail-closed: the new dataset is staged in a temporary directory and
 * validated (per-table subject yield, delta vs the committed output) BEFORE
 * the committed output directory is cleaned and replaced. A broken extract
 * therefore aborts without touching committed data. Intentional large
 * shrinks can be let through with the SYNC_ALLOW_SHRINK=1 escape hatch
 * (see deltaGuards.ts).
 */
export default async function transform(config: Config): Promise<void> {
  if (!config.transform) {
    throw new Error("Transform config section is required");
  }

  const inputPath = config.extract?.output;
  if (!inputPath) {
    throw new Error("Extract output path is required for transform");
  }

  const extractedData = await loadExtractedData(inputPath);
  const {
    store,
    prefixes,
    subjects,
    tableStats,
    malformedRows,
    unclassifiableRows,
  } = transformData(config.transform, extractedData);

  reportFilteredRows(tableStats);

  // Guard: a configured table that fetched rows but produced no subjects
  // means the mapping (or the extract payload) is broken - fail before
  // touching the committed output.
  assertTablesYieldSubjects(tableStats);

  // Guard: a row whose `uri` is present but degenerate loses its subject on
  // every sync. Threshold zero, so the defect fails at its cause (the named
  // upstream row) instead of surfacing later as an unexplained deletion count.
  assertNoMalformedRows(
    malformedRows,
    process.env[ALLOW_MALFORMED_ROWS_ENV_VAR] === "1",
  );

  // Guard: a row that names itself but resolves to no class used to vanish
  // with no signal whatsoever. Same threshold and same escape hatch as the
  // malformed-row guard, because it is the same kind of silent loss.
  assertNoUnclassifiableRows(
    unclassifiableRows,
    process.env[ALLOW_MALFORMED_ROWS_ENV_VAR] === "1",
  );

  // Materialize declared owl:inverseOf pairs (e.g. hasSubcomponent/
  // parentComponent, inheritsFrom/specializedBy) so the published graph is
  // self-contained without a consumer-side reasoner. Skipped if the ontology
  // is absent (e.g. minimal test fixtures).
  try {
    const ontologyTtl = await readFile(ONTOLOGY_PATH, "utf-8");
    const added = materializeInverses(store, ontologyTtl);
    if (added > 0) {
      console.log(`Materialized ${added} inverse triples`);
    }
  } catch {
    // No ontology file — nothing to materialize.
  }

  // Derive the ds:TokenBinding records from the anatomy literals the extract just
  // turned into triples (ADR J §6.3). The post-step is one call; the derivation, the
  // node path and the law that reads the records all live in tokenBindings.ts.
  for (const [prefix, namespace] of Object.entries(BINDING_PREFIXES)) {
    prefixes.add(prefix, namespace);
  }
  const bindings = deriveTokenBindings(store);
  console.log(
    `Derived ${bindings.records.length} token binding records from ${bindings.parsed}/${bindings.anatomies} anatomies`,
  );
  guardTokenBindings(store, config, bindings);

  const ext = config.transform.format === "ttl" ? "ttl" : "jsonld";
  const outputDir = config.transform.outputDir;

  // Stage the new dataset in a temp directory, compare it against the
  // committed one, and only then clean + swap. The committed output is never
  // destroyed before the staged replacement has passed the delta guards.
  const stagingDir = await mkdtemp(join(tmpdir(), "ds-transform-"));
  try {
    await writeDataset(
      stagingDir,
      config.transform,
      store,
      prefixes,
      subjects,
      ext,
    );

    const next = await collectDataMetrics(stagingDir, ext);
    const previous = await collectDataMetrics(outputDir, ext);
    assertNoUnexpectedShrink(
      previous,
      next,
      process.env[ALLOW_SHRINK_ENV_VAR] === "1",
    );

    await mkdir(outputDir, { recursive: true });
    await cleanOutputDir(outputDir, ext);
    await cp(stagingDir, outputDir, { recursive: true });
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  if (config.transform.atomicity === "class") {
    console.log(
      `Wrote ${subjects.length} subjects to ${join(outputDir, `all.${ext}`)}`,
    );
  } else {
    console.log(`Wrote ${subjects.length} files`);
  }
}

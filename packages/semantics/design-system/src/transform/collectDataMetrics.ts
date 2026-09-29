import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import jsonld from "jsonld";
import { Parser, type Quad } from "n3";
import { NAMESPACES, PREDICATES } from "../constants.js";

/** rdf:type object marking a tier subject (one tier = one output file under instance atomicity). */
const TIER_CLASS = `${NAMESPACES.ds}Tier`;

/**
 * Aggregate size metrics for a generated RDF dataset directory.
 *
 * Computed identically for the committed `data/` tree and for a freshly
 * staged transform output, so the two can be compared before the committed
 * tree is destroyed (see deltaGuards.ts).
 */
export interface DataMetrics {
  /** RDF files (matching the configured extension) found in the tree. */
  files: number;
  /** Distinct named (IRI) subjects across all files. Blank nodes excluded. */
  subjects: number;
  /** Distinct subjects typed `ds:Tier` — with instance atomicity, one tier = one file. */
  tiers: number;
  /** Total triples, i.e. every property usage including blank-node detail triples. */
  propertyUsage: number;
}

/**
 * Parse one serialized RDF file into quads.
 *
 * Turtle parses directly; JSON-LD is normalized to N-Quads first so both
 * formats are counted through the same code path.
 */
async function parseQuads(content: string, ext: string): Promise<Quad[]> {
  if (ext === "ttl") {
    return new Parser().parse(content);
  }
  const nquads = (await jsonld.toRDF(JSON.parse(content), {
    format: "application/n-quads",
  })) as string;
  return new Parser({ format: "N-Quads" }).parse(nquads);
}

/**
 * Walk a dataset directory and compute its {@link DataMetrics}.
 *
 * A missing directory yields all-zero metrics (first run: nothing committed
 * yet, so the delta guards have nothing to protect).
 *
 * @param dir - Root of the dataset tree (e.g. `data/` or a staging dir).
 * @param ext - RDF file extension without the dot (`ttl` or `jsonld`).
 */
export default async function collectDataMetrics(
  dir: string,
  ext: string,
): Promise<DataMetrics> {
  let entries: Dirent[];
  try {
    entries = (await readdir(dir, {
      withFileTypes: true,
      recursive: true,
    })) as Dirent[];
  } catch {
    return { files: 0, subjects: 0, tiers: 0, propertyUsage: 0 };
  }

  const files = entries.filter((e) => e.isFile() && e.name.endsWith(`.${ext}`));

  const subjects = new Set<string>();
  const tiers = new Set<string>();
  let propertyUsage = 0;

  for (const file of files) {
    const path = join(file.parentPath, file.name);
    const content = await readFile(path, "utf-8");

    let quads: Quad[];
    try {
      quads = await parseQuads(content, ext);
    } catch (error) {
      // A handful of committed files are not strictly parseable (legacy
      // source-data quirks: URIs with empty or leading-dot segments). The
      // regenerated dataset reproduces the same quirks, so skipping them on
      // BOTH sides keeps the before/after metrics comparable. The file still
      // counts towards the file total.
      console.warn(
        `collectDataMetrics: skipping unparseable ${path}: ${(error as Error).message}`,
      );
      continue;
    }

    for (const quad of quads) {
      propertyUsage += 1;
      if (quad.subject.termType !== "NamedNode") {
        continue;
      }
      subjects.add(quad.subject.value);
      if (
        quad.predicate.value === PREDICATES.type &&
        quad.object.value === TIER_CLASS
      ) {
        tiers.add(quad.subject.value);
      }
    }
  }

  return {
    files: files.length,
    subjects: subjects.size,
    tiers: tiers.size,
    propertyUsage,
  };
}

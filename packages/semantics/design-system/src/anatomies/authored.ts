/**
 * `anatomies/authored/` — the anatomies, written by hand.
 *
 * Each file is one anatomy, written from its implementation's stylesheet with the
 * judgement that takes, at `anatomies/authored/<tier>/<uri>.yaml`. The files are
 * reviewed as files, in a pull request, and they are what the Coda write (a later
 * step) sends to the `anatomy_dsl` cells: the text of the file is the text of the
 * cell, verbatim. Nothing else reads them, and nothing here writes them. `data/` stays
 * the Coda sync's alone, so the graph reflects the document and never a file that has
 * not reached it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { referenceIri } from "../transform/tokenBindings.js";

/** Where the authored anatomies live, relative to the repository root. */
export const AUTHORED_DIR = "anatomies/authored";

/** One authored anatomy. */
export interface AuthoredAnatomy {
  /** The dotted local name, from the file's own name. */
  uri: string;
  /** The subject IRI the literal belongs to. */
  block: string;
  /** The file it was read from, so a refusal can name it. */
  path: string;
  /** The YAML, verbatim — this is the text the `anatomy_dsl` cell receives. */
  text: string;
}

/**
 * The tier an anatomy belongs to: the first dotted segment of its `uri`, which is
 * also the name of the directory the file sits in.
 *
 * `anatomies/authored/` is split by tier, and `--tier` narrows a run to some of
 * them, so the tier has to be readable off a file without parsing its YAML.
 */
export function tierOf(uri: string): string {
  return uri.split(".")[0] as string;
}

/** The dotted local name a file carries: its own name, without the suffix. */
function uriOf(path: string): string {
  return (path.split("/").pop() as string).slice(0, -".yaml".length);
}

/** Every `.yaml` under a directory, recursively, sorted so a run is reproducible. */
function listYaml(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (entry.endsWith(".yaml")) {
        found.push(path);
      }
    }
  };
  walk(dir);
  return found;
}

/**
 * Every anatomy file under the directory.
 *
 * A missing directory is not an error here: it means nothing has been authored yet,
 * and the caller says so in its own words rather than propagating an `ENOENT` that
 * names a path the reader did not ask about.
 */
function authoredFiles(dir: string): string[] {
  try {
    return listYaml(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Every tier the directory holds, sorted, read from the file names alone.
 *
 * No anatomy is opened: this answers "is there such a tier" for a `--tier` that
 * names one the corpus does not have, and that refusal must not depend on reading
 * the anatomies the run did not ask for.
 */
export function readAuthoredTiers(dir: string = AUTHORED_DIR): string[] {
  const tiers = new Set(authoredFiles(dir).map((path) => tierOf(uriOf(path))));
  return [...tiers].sort();
}

/**
 * Read the authored anatomies.
 *
 * `tiers`, when given, narrows which files are READ: an author checking one tier
 * asks for that tier and the files of the others are never opened. The write does
 * not pass it — the law is a statement about the whole corpus, so the write reads
 * everything and narrows its PLAN instead.
 */
export default function readAuthored(
  dir: string = AUTHORED_DIR,
  tiers?: readonly string[],
): AuthoredAnatomy[] {
  return authoredFiles(dir)
    .map((path) => ({ path, uri: uriOf(path) }))
    .filter((file) => tiers === undefined || tiers.includes(tierOf(file.uri)))
    .map((file) => ({
      uri: file.uri,
      block: referenceIri(file.uri),
      path: file.path,
      text: readFileSync(file.path, "utf-8"),
    }));
}

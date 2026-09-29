/**
 * The anatomy corpus, read from the committed graph.
 *
 * Every non-empty `ds:anatomyDsl` literal in `data/`, keyed by its subject IRI — the
 * 134 of ADR J §1.2, across six tiers. `validate` reads it to run the law over the
 * tiers' literals, and the Coda write (a later step) reads it beside the authored
 * files to derive the closure it plans against Coda.
 *
 * It is deliberately a **store**, not a bare map: `deriveTokenBindings` needs the wider
 * graph to tell a `uri:` that names a block with an empty anatomy from one that names
 * no block at all, and that distinction is the difference between silence and an X11
 * finding.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Parser, type Quad } from "n3";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore } from "../graph/index.js";

/** Where the committed graph lives, relative to the repository root. */
export const DATA_DIR = "data";

/** One block's anatomy, as the graph holds it. */
export interface CorpusEntry {
  /** The subject IRI. */
  block: string;
  /** The dotted local name — what the register and Coda write. */
  uri: string;
  /** The tier, the first segment of the local name. */
  tier: string;
  /** The literal, verbatim. */
  anatomyDsl: string;
}

/** The corpus and the graph it was read from. */
export interface Corpus {
  entries: CorpusEntry[];
  /** Every `ds:` subject the graph holds, for the dangling-reference check. */
  store: GraphStore;
  /** Turtle files read. */
  files: number;
  /**
   * Files that are not parseable Turtle, each with the parser's own message.
   *
   * A defect in this repository rather than a fact about the corpus: the transform
   * wrote these files, so one that does not parse means the emitter produced
   * something no reader can read. It is REPORTED and named rather than thrown on,
   * because a stack trace names a line number and not a remedy, and because the
   * rest of the corpus is still worth measuring.
   */
  unparseable: Array<{ file: string; message: string }>;
}

/** Every `.ttl` under a directory, recursively, sorted so a run is reproducible. */
export function listTurtle(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (entry.endsWith(".ttl")) {
        found.push(path);
      }
    }
  };
  walk(dir);
  return found;
}

/**
 * Read the corpus from a directory of Turtle.
 *
 * A file that does not parse is REPORTED, by name and with the parser's message, and
 * the read goes on. The transform wrote these files, so an unparseable one is a defect
 * in this repository and not a fact about the corpus — but it is one file, and refusing
 * to measure the other hundreds because of it buys nothing. What it must not be is
 * silent: `validate` prints every one and `anatomies/census.json` carries the count,
 * so a file that stops parsing is a diff rather than a quietly smaller corpus.
 */
export function readCorpus(dir: string = DATA_DIR): Corpus {
  const store = new GraphStore();
  const files = listTurtle(dir);
  const parser = new Parser();

  const unparseable: Array<{ file: string; message: string }> = [];
  for (const file of files) {
    let quads: Quad[];
    try {
      quads = parser.parse(readFileSync(file, "utf-8"));
    } catch (error) {
      unparseable.push({ file, message: (error as Error).message });
      continue;
    }
    for (const quad of quads) {
      store.getN3Store().addQuad(quad);
    }
  }

  const entries: CorpusEntry[] = [];
  for (const quad of store.getQuads()) {
    if (quad.predicate.value !== PREDICATES.anatomyDsl) {
      continue;
    }
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.object.value.trim() === ""
    ) {
      continue;
    }
    const uri = quad.subject.value.slice(NAMESPACES.ds.length);
    entries.push({
      block: quad.subject.value,
      uri,
      tier: uri.split(".")[0],
      anatomyDsl: quad.object.value,
    });
  }

  entries.sort((left, right) => left.uri.localeCompare(right.uri));
  return { entries, store, files: files.length, unparseable };
}

/** Non-empty anatomies per tier, for the census and the `references` report. */
export function byTier(
  entries: readonly CorpusEntry[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.tier] = (counts[entry.tier] ?? 0) + 1;
  }
  return counts;
}

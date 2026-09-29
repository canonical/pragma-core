/**
 * `anatomies/census.json` — the corpus and its counts (ADR J §5.3).
 *
 * One committed file, written only by `anatomies validate --write-register`, read by
 * three things that must agree:
 *
 *   - the transform guard's two floors (`src/transform/bindingGuard.ts`);
 *   - pragma's `vocabulary.test.ts`, whose record floor and whose law over the
 *     `unresolved` list both read this file (§8.2);
 *   - `ci.yml`'s `census-drift` job, whose gate is `git diff --exit-code`.
 *
 * `unresolved` is the reason the law's exception needs no third vocabulary term: it is
 * the sorted list of element names the register admits under the resolution
 * categories, and it is also what the Coda write puts in the `tokens` table's
 * `register` column.
 *
 * There is deliberately no timestamp here. Every field is a measurement of the
 * committed corpus against a pinned dependency, so two runs of the same checkout must
 * produce byte-identical files — that is what makes
 * `git diff --exit-code anatomies/census.json` a signal rather than a daily red bar.
 */
import { readFileSync, writeFileSync } from "node:fs";

/** Where the census lives, relative to the repository root. */
export const CENSUS_PATH = "anatomies/census.json";

export interface Census {
  /** Non-empty `ds:anatomyDsl` literals in `data/`. */
  anatomies: number;
  /** How many of those parse as an anatomy document. A floor for the guard. */
  parseable: number;
  /** Record identities derived from the corpus. A floor for the guard and for pragma. */
  records: number;
  /**
   * Turtle files under `data/` that do not parse.
   *
   * The transform wrote them, so a non-zero count is a defect in this repository and
   * not a fact about the corpus. It is a COUNT here for the same reason every other
   * number is: the regeneration and the diff are what keep it from moving unnoticed,
   * and `validate` prints each file by name beside it.
   */
  unparseableFiles: number;
  /** Declared symbols: S1's plus the channels S2 mints. */
  symbols: number;
  /** Element names the register admits under the resolution categories, sorted. */
  unresolved: string[];
  /** Rows per register category. */
  categories: Record<string, number>;
}

/** Read the census, or `null` when none is committed yet. */
export function readCensus(path: string = CENSUS_PATH): Census | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Census;
  } catch {
    return null;
  }
}

/** Render a census deterministically: two-space JSON with a trailing newline. */
export function renderCensus(census: Census): string {
  return `${JSON.stringify(census, null, 2)}\n`;
}

/** Write the census. Called only by `validate --write-register`. */
export function writeCensus(census: Census, path: string = CENSUS_PATH): void {
  writeFileSync(path, renderCensus(census), "utf-8");
}

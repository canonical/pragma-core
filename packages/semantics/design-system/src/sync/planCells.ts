/**
 * The plan: which `anatomy_dsl` cells the document would have to change.
 *
 * Pure, and one function for both directions. `anatomies write` wants the cells the
 * authored files would change; `anatomies restore` wants the cells a snapshot would
 * change. Both are the same question — here is the text a cell should hold, what does
 * it hold now — so both are planned by {@link planDesiredCells} and printed by one
 * renderer. Two implementations would be two chances to diff a cell differently.
 *
 * The match is by `uri` and never by row id: the row id is where a row happens to
 * live, and the `uri` is what the row is. A desired cell whose `uri` names no live
 * row is reported rather than created — the roster of blocks is the pull sync's, and
 * inventing a row here would put a block in the document that the graph does not have.
 */
import { type AuthoredAnatomy, tierOf } from "../anatomies/authored.js";
import type { LiveBlocks } from "./liveBlocks.js";

/** What some source says a cell should hold. */
export interface DesiredCell {
  /** The dotted local name, which is how the live row is found. */
  uri: string;
  /** The text the cell should hold, verbatim. */
  text: string;
  /** Where it came from — a file path, or the snapshot — so a line can name it. */
  source: string;
}

/** A cell whose text differs from what the document holds. */
export interface CellUpdate {
  uri: string;
  rowId: string;
  /** What the cell holds now. */
  before: string;
  /** What it would hold after the write. */
  after: string;
  source: string;
}

/** A desired cell with no live row to put it in. */
export interface MissingCell {
  uri: string;
  source: string;
}

/** Which direction a plan is, which is all the renderer needs to word itself. */
export type Verb = "write" | "restore";

/** The plan, with every bucket kept separate so the counts add up in public. */
export interface CellPlan {
  verb: Verb;
  /**
   * Desired cells considered — after `--tier` and `--only`, so the counts are of
   * this run and not of the corpus the law was run over.
   */
  considered: number;
  /** The cells that already hold their text, by `uri`. */
  unchanged: string[];
  /** The cells to change. */
  updates: CellUpdate[];
  /** The desired cells with no live row. */
  missing: MissingCell[];
  /** The one anatomy the run was scoped to, or null. */
  only: string | null;
  /**
   * The tiers in force, or null when every tier is. Only a write has these — a
   * snapshot is of the whole table and is restored as it was taken.
   */
  tiers: string[] | null;
}

/** Where two texts first disagree, and how long each of them is. */
export interface CellDiff {
  beforeLines: number;
  afterLines: number;
  /** The 1-based line number of the first difference. */
  line: number;
  /** That line as the cell holds it; the empty string past the end. */
  before: string;
  /** That line as the file holds it; the empty string past the end. */
  after: string;
}

/**
 * Describe an update compactly: the two lengths, and the first line that differs.
 *
 * Enough for a reader to recognise the change without printing two whole documents
 * per cell — a full corpus write would otherwise be tens of thousands of lines. The
 * whole text of both sides is in `--json`.
 */
export function describeDiff(update: CellUpdate): CellDiff {
  const before = update.before.split("\n");
  const after = update.after.split("\n");
  // The texts differ, or this would not be an update — so a first difference always
  // exists, and past the end of the shorter side it is a line against nothing.
  let index = 0;
  while (index < Math.max(before.length, after.length)) {
    if ((before[index] ?? "") !== (after[index] ?? "")) {
      break;
    }
    index += 1;
  }
  return {
    beforeLines: before.length,
    afterLines: after.length,
    line: index + 1,
    before: before[index] ?? "",
    after: after[index] ?? "",
  };
}

/**
 * Two cell texts are the same when they differ by at most one trailing newline:
 * the document stores the text without it and hands it back without it, and a
 * file ends with one, so an exact comparison would rewrite every cell on every run.
 */
export function sameCell(live: string, desired: string): boolean {
  return live.replace(/\n$/, "") === desired.replace(/\n$/, "");
}

/**
 * Plan a set of desired cells against the live table.
 *
 * The two narrowings compose, and in this order: `tiers` says which tiers are being
 * written this round, and `only` picks one anatomy out of them — so an `--only` in a
 * tier the run does not cover considers nothing, which is the honest answer rather
 * than a cell written outside the tiers the header names.
 */
export function planDesiredCells(
  desired: readonly DesiredCell[],
  live: LiveBlocks,
  verb: Verb,
  only?: string,
  tiers?: readonly string[],
): CellPlan {
  const inTier =
    tiers === undefined
      ? desired
      : desired.filter((entry) => tiers.includes(tierOf(entry.uri)));
  const scoped =
    only === undefined ? inTier : inTier.filter((entry) => entry.uri === only);

  const unchanged: string[] = [];
  const updates: CellUpdate[] = [];
  const missing: MissingCell[] = [];

  for (const entry of scoped) {
    const row = live.byUri.get(entry.uri);
    if (row === undefined) {
      missing.push({ uri: entry.uri, source: entry.source });
      continue;
    }
    if (sameCell(row.anatomyDsl, entry.text)) {
      unchanged.push(entry.uri);
      continue;
    }
    updates.push({
      uri: entry.uri,
      rowId: row.rowId,
      before: row.anatomyDsl,
      after: entry.text,
      source: entry.source,
    });
  }

  return {
    verb,
    considered: scoped.length,
    unchanged,
    updates,
    missing,
    only: only ?? null,
    tiers: tiers === undefined ? null : [...tiers],
  };
}

/**
 * Plan the authored files against the live table.
 *
 * `tiers` narrows the plan and nothing else: every authored file was read and the
 * law was run over every one of them before this is called, because a corpus is
 * lawful or not as a whole. What this decides is which of those files this round
 * sends to the document.
 */
export default function planCells(
  authored: readonly AuthoredAnatomy[],
  live: LiveBlocks,
  only?: string,
  tiers?: readonly string[],
): CellPlan {
  return planDesiredCells(
    authored.map((entry) => ({
      uri: entry.uri,
      text: entry.text,
      source: entry.path,
    })),
    live,
    "write",
    only,
    tiers,
  );
}

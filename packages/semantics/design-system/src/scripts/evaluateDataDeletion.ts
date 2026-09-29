/**
 * Share of the committed corpus (counted in lines) that a single sync may
 * *lose* — delete without adding comparable content back.
 *
 * Why a NET figure and not a gross deletion count: `data/` is regenerated
 * from scratch on every sync, so an in-place content change (a reworded
 * summary, a re-derived anatomy literal) shows up as a deletion *and* an
 * addition of the same magnitude. A gross count cannot tell that apart from
 * content vanishing, and the sync spent 23 consecutive days blocked because
 * of it: a run reporting +3947/-333 was treated identically to a run that
 * lost 333 lines outright. Netting the additions off the deletions is the
 * whole distinction — a rewrite nets to zero (or negative), a loss nets to
 * the amount lost.
 *
 * Why a PROPORTION and not an absolute allowance: the corpus grows, and an
 * absolute line count has to be raised every time it does — a threshold that
 * needs periodic hand-tuning is a threshold that will be wrong. A share of
 * the committed corpus tracks the corpus by construction.
 *
 * Why 2%: the 25 scheduled syncs before the outage never lost a single net
 * line (24 of them netted exactly 0, one netted -11). Net loss in healthy
 * operation is <= 0, so the allowance exists only to absorb genuine
 * retirement of a handful of blocks. 2% of today's 6,106-line corpus is 122
 * lines, roughly seven retired blocks with nothing replacing them — orders of
 * magnitude above observed churn and far below any regression worth having.
 */
export const DEFAULT_MAX_NET_LINE_LOSS_RATIO = 0.02;

/**
 * Share of the committed corpus (counted in files) that a single sync may
 * lose, netting created files off deleted ones.
 *
 * This replaces the old absolute `deletedFiles > 5` limit, which had exactly
 * the same churn-versus-loss defect as the line count: with one file per
 * subject, re-tiering or renaming a block is a delete plus a create, so a
 * harmless reorganisation spends the budget of a real loss. (The run that
 * exposed this deleted 5 files — sitting precisely on the old limit — while
 * creating 52.) The file signal is worth keeping as a second, independent
 * check because the two fail differently: whole subjects can disappear while
 * the line total stays flat, if another table grew at the same time.
 */
export const DEFAULT_MAX_NET_FILE_LOSS_RATIO = 0.02;

/**
 * Catastrophic backstop: net lines lost that are refused regardless of how
 * small a share of the corpus they are.
 *
 * A proportion alone degrades as the corpus grows — at 100,000 committed
 * lines, 2% would wave through 2,000 lines of silently deleted spec data.
 * This ceiling is deliberately inert today (2% of 6,106 lines is 122, well
 * under it) and only binds once the corpus passes ~25,000 lines.
 */
export const DEFAULT_MAX_NET_DELETED_LINES = 500;

/**
 * Inputs for {@link evaluateDataDeletion} — raw git output for the staged
 * diff, the size of the committed corpus it is measured against, and
 * optional threshold overrides.
 */
export interface DeletionInput {
  /** Output of `git diff --cached --numstat -- <dataDir>`. */
  numstat: string;
  /** Output of `git diff --cached --name-status -- <dataDir>`. */
  nameStatus: string;
  /** Lines in the committed corpus under the data dir (see {@link measureCorpus}). */
  corpusLines: number;
  /** Files in the committed corpus under the data dir (see {@link measureCorpus}). */
  corpusFiles: number;
  /** Override for {@link DEFAULT_MAX_NET_LINE_LOSS_RATIO}. */
  maxNetLineLossRatio?: number;
  /** Override for {@link DEFAULT_MAX_NET_FILE_LOSS_RATIO}. */
  maxNetFileLossRatio?: number;
  /** Override for {@link DEFAULT_MAX_NET_DELETED_LINES}. */
  maxNetDeletedLines?: number;
}

/**
 * Result of evaluating a staged data diff against the loss thresholds.
 */
export interface DeletionEvaluation {
  /** Total lines added across the staged diff. */
  addedLines: number;
  /** Total lines deleted across the staged diff. */
  deletedLines: number;
  /** Lines lost: deleted minus added. Negative when the corpus grew. */
  netDeletedLines: number;
  /** Files created outright (name-status `A`). */
  addedFiles: number;
  /** Files deleted outright (name-status `D`). */
  deletedFiles: number;
  /** Files lost: deleted minus created. Negative when files were gained. */
  netDeletedFiles: number;
  /** Net lines this diff was allowed to lose. */
  allowedNetDeletedLines: number;
  /** Net files this diff was allowed to lose. */
  allowedNetDeletedFiles: number;
  /** Human-readable descriptions of every threshold exceeded (empty = safe). */
  violations: string[];
}

/**
 * Parse one numstat count field. Binary files report "-"; missing fields
 * (malformed lines) count as zero.
 */
function toCount(field: string | undefined): number {
  const parsed = Number.parseInt(field ?? "", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Sum the added/deleted columns of `git diff --numstat` output. */
function sumNumstat(numstat: string): {
  added: number;
  deleted: number;
  files: number;
} {
  let added = 0;
  let deleted = 0;
  let files = 0;

  for (const line of numstat.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    const fields = line.split("\t");
    added += toCount(fields[0]);
    deleted += toCount(fields[1]);
    files += 1;
  }

  return { added, deleted, files };
}

/**
 * Measure the committed corpus from a numstat diff of the empty tree against
 * HEAD, in which every line of every committed file appears as an addition.
 *
 * Using git's own numstat for this (rather than walking the working tree)
 * matters because the sync has already overwritten `data/` on disk by the
 * time the guard runs: the baseline the diff is measured against is HEAD, so
 * the corpus size must come from HEAD too.
 *
 * @param numstat - Output of `git diff --numstat <empty-tree> HEAD -- <dataDir>`.
 */
export function measureCorpus(numstat: string): {
  lines: number;
  files: number;
} {
  const { added, files } = sumNumstat(numstat);
  return { lines: added, files };
}

/** Count `git diff --name-status` lines carrying a given status letter. */
function countStatus(nameStatus: string, status: "A" | "D"): number {
  return nameStatus.split("\n").filter((line) => line.startsWith(`${status}\t`))
    .length;
}

/** Render a ratio as a percentage for a human-readable violation message. */
function asPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Evaluate a staged `data/` diff for CONTENT LOSS.
 *
 * This is the workflow-level safety net of the fail-closed pull sync: even if
 * the in-process transform guards regress, a regeneration that makes
 * committed spec data disappear must not be committed.
 *
 * The rule is net loss (deletions minus additions) measured as a share of the
 * committed corpus, with an absolute ceiling as a catastrophic backstop. It
 * passes content rewritten in place — large deletions with comparable
 * additions, which is what a re-derivation of authored literals looks like —
 * and fails deletions that nothing replaces. See the threshold constants
 * above for why each part of the rule is shaped that way.
 *
 * Pure function over git's text output so it is unit-testable; the
 * checkDataDeletion.ts CLI wires it to the actual repository.
 *
 * @param input - Git diff output, committed corpus size, optional overrides.
 * @returns Totals plus the list of tripped thresholds (empty when safe).
 */
export default function evaluateDataDeletion(
  input: DeletionInput,
): DeletionEvaluation {
  const { added: addedLines, deleted: deletedLines } = sumNumstat(
    input.numstat,
  );
  const addedFiles = countStatus(input.nameStatus, "A");
  const deletedFiles = countStatus(input.nameStatus, "D");

  const netDeletedLines = deletedLines - addedLines;
  const netDeletedFiles = deletedFiles - addedFiles;

  const maxNetLineLossRatio =
    input.maxNetLineLossRatio ?? DEFAULT_MAX_NET_LINE_LOSS_RATIO;
  const maxNetFileLossRatio =
    input.maxNetFileLossRatio ?? DEFAULT_MAX_NET_FILE_LOSS_RATIO;
  const maxNetDeletedLines =
    input.maxNetDeletedLines ?? DEFAULT_MAX_NET_DELETED_LINES;

  // The proportional allowance, clamped by the catastrophic ceiling.
  const proportionalLineAllowance = Math.floor(
    input.corpusLines * maxNetLineLossRatio,
  );
  const allowedNetDeletedLines = Math.min(
    proportionalLineAllowance,
    maxNetDeletedLines,
  );
  const allowedNetDeletedFiles = Math.floor(
    input.corpusFiles * maxNetFileLossRatio,
  );

  const violations: string[] = [];
  if (netDeletedLines > allowedNetDeletedLines) {
    violations.push(
      `net loss of ${netDeletedLines} lines (${deletedLines} deleted, ` +
        `${addedLines} added) exceeds the ${allowedNetDeletedLines}-line ` +
        `allowance (${asPercent(maxNetLineLossRatio)} of the ` +
        `${input.corpusLines}-line committed corpus, capped at ` +
        `${maxNetDeletedLines})`,
    );
  }
  if (netDeletedFiles > allowedNetDeletedFiles) {
    violations.push(
      `net loss of ${netDeletedFiles} files (${deletedFiles} deleted, ` +
        `${addedFiles} created) exceeds the ${allowedNetDeletedFiles}-file ` +
        `allowance (${asPercent(maxNetFileLossRatio)} of the ` +
        `${input.corpusFiles} committed files)`,
    );
  }

  return {
    addedLines,
    deletedLines,
    netDeletedLines,
    addedFiles,
    deletedFiles,
    netDeletedFiles,
    allowedNetDeletedLines,
    allowedNetDeletedFiles,
    violations,
  };
}

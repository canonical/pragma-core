#!/usr/bin/env bun
/**
 * Workflow-level content-loss guard for the Coda pull sync.
 *
 * Usage: bun src/scripts/checkDataDeletion.ts [dataDir]
 *
 * Inspects the STAGED diff (`git diff --cached`) for the data directory and
 * exits non-zero when the regeneration LOSES committed content, i.e. deletes
 * lines or files that nothing added back. Content rewritten in place (large
 * deletions with comparable additions) passes. Stage the regenerated output
 * first (`git add data/`).
 *
 * Environment:
 * - SYNC_MAX_NET_LINE_LOSS_RATIO / SYNC_MAX_NET_FILE_LOSS_RATIO: override the
 *   proportional allowances (fractions, e.g. 0.02).
 * - SYNC_MAX_NET_DELETED_LINES: override the catastrophic absolute ceiling.
 * - SYNC_ALLOW_SHRINK=1: escape hatch for intentional large deletions
 *   (exposed as the manual sync workflow's `allow_shrink` input).
 */
import { execFileSync } from "node:child_process";
import { ALLOW_SHRINK_ENV_VAR } from "../transform/deltaGuards.js";
import evaluateDataDeletion, { measureCorpus } from "./evaluateDataDeletion.js";

const dataDir = process.argv[2] ?? "data/";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf-8" });
}

function stagedDiff(mode: "--numstat" | "--name-status"): string {
  return git(["diff", "--cached", mode, "--", dataDir]);
}

/**
 * Size of the committed corpus the staged diff is measured against.
 *
 * Diffing the empty tree against HEAD reports every committed line as an
 * addition, so the corpus is measured by the same numstat parser as the diff
 * itself — and, crucially, from HEAD rather than the working tree, which the
 * transform has already overwritten by the time this runs.
 */
function committedCorpus(): { lines: number; files: number } {
  const emptyTree = git(["hash-object", "-t", "tree", "/dev/null"]).trim();
  return measureCorpus(
    git(["diff", "--numstat", emptyTree, "HEAD", "--", dataDir]),
  );
}

function envNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

const corpus = committedCorpus();

const result = evaluateDataDeletion({
  numstat: stagedDiff("--numstat"),
  nameStatus: stagedDiff("--name-status"),
  corpusLines: corpus.lines,
  corpusFiles: corpus.files,
  maxNetLineLossRatio: envNumber("SYNC_MAX_NET_LINE_LOSS_RATIO"),
  maxNetFileLossRatio: envNumber("SYNC_MAX_NET_FILE_LOSS_RATIO"),
  maxNetDeletedLines: envNumber("SYNC_MAX_NET_DELETED_LINES"),
});

console.log(
  `Staged diff for ${dataDir}: +${result.addedLines}/-${result.deletedLines} lines, ` +
    `${result.addedFiles} file(s) created, ${result.deletedFiles} file(s) deleted`,
);
console.log(
  `Net loss: ${result.netDeletedLines} lines (allowance ${result.allowedNetDeletedLines}), ` +
    `${result.netDeletedFiles} files (allowance ${result.allowedNetDeletedFiles}) ` +
    `against a committed corpus of ${corpus.lines} lines in ${corpus.files} files`,
);

if (result.violations.length === 0) {
  console.log("Deletion guard passed");
} else if (process.env[ALLOW_SHRINK_ENV_VAR] === "1") {
  console.warn(
    `${ALLOW_SHRINK_ENV_VAR}=1 set - allowing intentional deletion despite: ${result.violations.join("; ")}`,
  );
} else {
  console.error(
    `Deletion guard FAILED - refusing to commit:\n- ${result.violations.join("\n- ")}`,
  );
  console.error(
    "If this deletion is intentional, re-run the manual sync workflow with " +
      `allow_shrink enabled (or set ${ALLOW_SHRINK_ENV_VAR}=1).`,
  );
  process.exit(1);
}

import { describe, expect, it } from "vitest";
import evaluateDataDeletion, {
  DEFAULT_MAX_NET_DELETED_LINES,
  measureCorpus,
} from "./evaluateDataDeletion.js";

/**
 * The committed corpus these cases are measured against, taken from this
 * repository at the commit the guard was rewritten on:
 *
 *   git diff --numstat $(git hash-object -t tree /dev/null) HEAD -- data/
 *   => 6106 added lines across 384 files
 *
 * The proportional allowances therefore work out at 122 lines (2% of 6106)
 * and 7 files (2% of 384).
 */
const CORPUS_LINES = 6106;
const CORPUS_FILES = 384;

const corpus = { corpusLines: CORPUS_LINES, corpusFiles: CORPUS_FILES };

/** Build numstat output for `files` files each reporting +added/-deleted. */
function numstat(
  entries: Array<{ added: number; deleted: number; path: string }>,
): string {
  return entries.map((e) => `${e.added}\t${e.deleted}\t${e.path}`).join("\n");
}

/** Build name-status output from a status letter and a file count. */
function nameStatus(entries: Array<{ status: string; path: string }>): string {
  return entries.map((e) => `${e.status}\t${e.path}`).join("\n");
}

/**
 * Spread a total churn over `count` files as one numstat blob, distributing
 * the remainder so the per-file counts sum to the stated totals exactly.
 */
function spread(
  count: number,
  addedTotal: number,
  deletedTotal: number,
): string {
  const share = (total: number, index: number) =>
    Math.floor(total / count) + (index < total % count ? 1 : 0);
  return numstat(
    Array.from({ length: count }, (_, i) => ({
      added: share(addedTotal, i),
      deleted: share(deletedTotal, i),
      path: `data/global/component/c${i}.ttl`,
    })),
  );
}

function statuses(count: number, status: string, offset = 0): string {
  return nameStatus(
    Array.from({ length: count }, (_, i) => ({
      status,
      path: `data/global/component/c${i + offset}.ttl`,
    })),
  );
}

describe("measureCorpus", () => {
  it("reads the corpus size out of an empty-tree numstat diff", () => {
    // Every committed line shows up as an addition against the empty tree.
    const result = measureCorpus("16\t0\tdata/a.ttl\n20\t0\tdata/b.ttl\n");

    expect(result).toEqual({ lines: 36, files: 2 });
  });

  it("reports an empty corpus for a first run", () => {
    expect(measureCorpus("")).toEqual({ lines: 0, files: 0 });
  });
});

describe("evaluateDataDeletion", () => {
  it("passes an empty diff", () => {
    const result = evaluateDataDeletion({
      numstat: "",
      nameStatus: "",
      ...corpus,
    });

    expect(result).toEqual({
      addedLines: 0,
      deletedLines: 0,
      netDeletedLines: 0,
      addedFiles: 0,
      deletedFiles: 0,
      netDeletedFiles: 0,
      allowedNetDeletedLines: 122,
      allowedNetDeletedFiles: 7,
      violations: [],
    });
  });

  it("sums added and deleted lines across files", () => {
    const result = evaluateDataDeletion({
      numstat: "3\t1\tdata/a.ttl\n10\t2\tdata/b.ttl\n",
      nameStatus: "M\tdata/a.ttl\nM\tdata/b.ttl\n",
      ...corpus,
    });

    expect(result.addedLines).toBe(13);
    expect(result.deletedLines).toBe(3);
    expect(result.netDeletedLines).toBe(-10);
    expect(result.violations).toEqual([]);
  });

  it("treats binary counts ('-') and malformed lines as zero", () => {
    const result = evaluateDataDeletion({
      numstat: "-\t-\tdata/img.png\ngarbage-line\n",
      nameStatus: "M\tdata/img.png\n",
      ...corpus,
    });

    expect(result.addedLines).toBe(0);
    expect(result.deletedLines).toBe(0);
    expect(result.violations).toEqual([]);
  });

  it("does not count renames or modifications as deleted or created files", () => {
    const result = evaluateDataDeletion({
      numstat: "1\t1\tdata/{old.ttl => new.ttl}\n2\t2\tdata/x.ttl",
      nameStatus: "R100\tdata/old.ttl\tdata/new.ttl\nM\tdata/x.ttl",
      ...corpus,
    });

    expect(result.deletedFiles).toBe(0);
    expect(result.addedFiles).toBe(0);
    expect(result.violations).toEqual([]);
  });

  describe("verdicts on real and plausible diffs", () => {
    /**
     * Each case states the diff, the verdict, and where its numbers come
     * from. The pair that matters is "today's real staged diff" and "a pure
     * deletion of today's magnitude": identical gross deletions, opposite
     * verdicts. The retired gross rule could not tell them apart, and blocked
     * both.
     */
    const cases = [
      {
        name: "today's real staged diff: an in-place regeneration that grew the corpus",
        // The run of 2026-09-10, from the sync job log: 431 files written,
        // +3947/-333 lines, 5 files deleted (and 52 created: 431 written
        // against 384 committed, 5 of which went away).
        numstat: spread(100, 3947, 333),
        nameStatus: `${statuses(5, "D")}\n${statuses(52, "A", 100)}`,
        expectPass: true,
      },
      {
        name: "a real historical enrichment sync (+2413/-943, 2 deleted, 48 created)",
        // Commit 8e37532, "data: sync from Coda with enriched extract" — the
        // same shape as today's run, and also over the retired gross limit.
        numstat: spread(50, 2413, 943),
        nameStatus: `${statuses(2, "D")}\n${statuses(48, "A", 50)}`,
        expectPass: true,
      },
      {
        name: "a pure deletion of today's magnitude, with nothing added back",
        // 333 lines lost outright = 5.5% of the corpus, over the 122-line
        // (2%) allowance. Identical gross deletions to the passing case
        // above; only the additions differ.
        numstat: spread(20, 0, 333),
        nameStatus: statuses(20, "M"),
        expectPass: false,
        expectViolation:
          "net loss of 333 lines (333 deleted, 0 added) exceeds the 122-line allowance",
      },
      {
        name: "a proportional catastrophe: the upstream returns a fraction of its rows",
        // 20 subjects instead of 384: nearly the whole corpus disappears.
        numstat: spread(364, 0, 5800),
        nameStatus: statuses(364, "D"),
        expectPass: false,
        expectViolation: "net loss of 5800 lines",
      },
      {
        name: "an in-place rewrite of 134 anatomy literals",
        // 134 files re-derived: each loses its old literal block and gains a
        // comparable new one. Enormous churn, no loss.
        numstat: spread(134, 2680, 2412),
        nameStatus: statuses(134, "M"),
        expectPass: true,
      },
      {
        name: "an in-place rewrite that also loses whole files",
        // Churn nets out, but 40 subjects vanish with nothing replacing
        // them: the file signal catches what the line signal cannot.
        numstat: spread(134, 2680, 2680),
        nameStatus: statuses(40, "D"),
        expectPass: false,
        expectViolation:
          "net loss of 40 files (40 deleted, 0 created) exceeds the 7-file allowance",
      },
      {
        name: "retiring a handful of blocks stays inside the allowance",
        // Genuine, intentional retirement of 5 blocks (~16 lines each).
        numstat: spread(5, 0, 80),
        nameStatus: statuses(5, "D"),
        expectPass: true,
      },
    ] as const;

    for (const testCase of cases) {
      it(`${testCase.expectPass ? "passes" : "fails"}: ${testCase.name}`, () => {
        const result = evaluateDataDeletion({
          numstat: testCase.numstat,
          nameStatus: testCase.nameStatus,
          ...corpus,
        });

        if (testCase.expectPass) {
          expect(result.violations).toEqual([]);
          return;
        }
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations.join("\n")).toContain(
          testCase.expectViolation,
        );
      });
    }
  });

  it("scales its allowance with the corpus instead of needing a raised constant", () => {
    // The same 200-line net loss: a violation of a small corpus, routine
    // against one ten times the size. No constant changes hands.
    const diff = { numstat: "0\t200\tdata/a.ttl", nameStatus: "M\tdata/a.ttl" };

    expect(
      evaluateDataDeletion({ ...diff, corpusLines: 6106, corpusFiles: 384 })
        .violations,
    ).toHaveLength(1);
    expect(
      evaluateDataDeletion({ ...diff, corpusLines: 61060, corpusFiles: 3840 })
        .violations,
    ).toEqual([]);
  });

  it("applies the absolute ceiling as a catastrophic backstop on a huge corpus", () => {
    // 2% of a million lines would be 20,000; the ceiling refuses far sooner.
    const netLoss = DEFAULT_MAX_NET_DELETED_LINES + 1;
    const result = evaluateDataDeletion({
      numstat: `0\t${netLoss}\tdata/a.ttl`,
      nameStatus: "M\tdata/a.ttl",
      corpusLines: 1_000_000,
      corpusFiles: 50_000,
    });

    expect(result.allowedNetDeletedLines).toBe(DEFAULT_MAX_NET_DELETED_LINES);
    expect(result.violations).toEqual([
      `net loss of ${netLoss} lines (${netLoss} deleted, 0 added) exceeds ` +
        `the ${DEFAULT_MAX_NET_DELETED_LINES}-line allowance (2.0% of the ` +
        `1000000-line committed corpus, capped at ${DEFAULT_MAX_NET_DELETED_LINES})`,
    ]);
  });

  it("passes a net loss sitting exactly on the allowance", () => {
    const result = evaluateDataDeletion({
      numstat: "0\t122\tdata/a.ttl",
      nameStatus: "M\tdata/a.ttl",
      ...corpus,
    });

    expect(result.netDeletedLines).toBe(122);
    expect(result.violations).toEqual([]);
  });

  it("honors threshold overrides", () => {
    const result = evaluateDataDeletion({
      numstat: "0\t10\tdata/a.ttl",
      nameStatus: "D\tdata/a.ttl\nD\tdata/b.ttl",
      corpusLines: 100,
      corpusFiles: 10,
      maxNetLineLossRatio: 0.05,
      maxNetFileLossRatio: 0.1,
      maxNetDeletedLines: 4,
    });

    expect(result.violations).toEqual([
      "net loss of 10 lines (10 deleted, 0 added) exceeds the 4-line " +
        "allowance (5.0% of the 100-line committed corpus, capped at 4)",
      "net loss of 2 files (2 deleted, 0 created) exceeds the 1-file " +
        "allowance (10.0% of the 10 committed files)",
    ]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataMetrics } from "./collectDataMetrics.js";
import {
  ALLOW_MALFORMED_ROWS_ENV_VAR,
  ALLOW_SHRINK_ENV_VAR,
  assertNoMalformedRows,
  assertNoUnclassifiableRows,
  assertNoUnexpectedShrink,
  assertTablesYieldSubjects,
  MAX_MALFORMED_ROWS,
} from "./deltaGuards.js";

function metrics(overrides: Partial<DataMetrics> = {}): DataMetrics {
  return { files: 0, subjects: 0, tiers: 0, propertyUsage: 0, ...overrides };
}

/**
 * Table stats with `eligible` defaulted to the rows that were not filtered,
 * so each test states only the numbers it is actually about.
 */
function stats(rows: number, subjects: number, filtered = 0) {
  return { rows, filtered, eligible: rows - filtered, subjects };
}

describe("assertTablesYieldSubjects", () => {
  it("passes for healthy and genuinely empty tables", () => {
    expect(() =>
      assertTablesYieldSubjects({
        uiBlocks: stats(125, 125),
        changeLog: stats(0, 0),
      }),
    ).not.toThrow();
  });

  it("passes when every row of a table was legitimately filtered", () => {
    // A Concepts table whose every row is still under the content minimum
    // yields no subjects and is not broken. Measuring against raw `rows`
    // instead of `eligible` would read this as a broken mapping and refuse
    // an otherwise healthy sync.
    expect(() =>
      assertTablesYieldSubjects({ concepts: stats(26, 0, 26) }),
    ).not.toThrow();
  });

  it("throws when a non-empty table produced zero subjects", () => {
    expect(() =>
      assertTablesYieldSubjects({ uiBlocks: stats(125, 0) }),
    ).toThrow("uiBlocks (125 eligible of 125 rows)");
  });

  it("lists every broken table in the error", () => {
    const run = () =>
      assertTablesYieldSubjects({
        uiBlocks: stats(5, 0),
        tiers: stats(2, 0),
      });

    expect(run).toThrow("uiBlocks (5 eligible of 5 rows)");
    expect(run).toThrow("tiers (2 eligible of 2 rows)");
  });
});

describe("assertNoUnexpectedShrink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const committed = metrics({ subjects: 100, tiers: 5, propertyUsage: 1000 });

  it("passes when the dataset stays equal or grows", () => {
    expect(() =>
      assertNoUnexpectedShrink(committed, committed, false),
    ).not.toThrow();
    expect(() =>
      assertNoUnexpectedShrink(
        committed,
        metrics({ subjects: 120, tiers: 6, propertyUsage: 1200 }),
        false,
      ),
    ).not.toThrow();
  });

  it("passes on a first run against an empty committed dataset", () => {
    expect(() =>
      assertNoUnexpectedShrink(
        metrics(),
        metrics({ subjects: 10, tiers: 1, propertyUsage: 30 }),
        false,
      ),
    ).not.toThrow();
  });

  it("allows a subject drop up to the threshold but not beyond", () => {
    expect(() =>
      assertNoUnexpectedShrink(
        metrics({ subjects: 100 }),
        metrics({ subjects: 90 }),
        false,
      ),
    ).not.toThrow();

    expect(() =>
      assertNoUnexpectedShrink(
        metrics({ subjects: 100 }),
        metrics({ subjects: 89 }),
        false,
      ),
    ).toThrow(/subject count would drop from 100 to 89/);
  });

  it("fails when the tier file count drops at all", () => {
    expect(() =>
      assertNoUnexpectedShrink(
        metrics({ tiers: 17 }),
        metrics({ tiers: 16 }),
        false,
      ),
    ).toThrow(/tier file count would drop from 17 to 16/);
  });

  it("allows a property-usage drop up to the threshold but not beyond", () => {
    expect(() =>
      assertNoUnexpectedShrink(
        metrics({ propertyUsage: 1000 }),
        metrics({ propertyUsage: 950 }),
        false,
      ),
    ).not.toThrow();

    expect(() =>
      assertNoUnexpectedShrink(
        metrics({ propertyUsage: 1000 }),
        metrics({ propertyUsage: 949 }),
        false,
      ),
    ).toThrow(/property usage \(triple count\) would drop from 1000 to 949/);
  });

  it("reports every violation at once, with the escape hatch hint", () => {
    const run = () => assertNoUnexpectedShrink(committed, metrics(), false);

    expect(run).toThrow(/subject count/);
    expect(run).toThrow(/tier file count/);
    expect(run).toThrow(/property usage/);
    expect(run).toThrow(ALLOW_SHRINK_ENV_VAR);
  });

  it("warns instead of throwing when the escape hatch is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      assertNoUnexpectedShrink(committed, metrics(), true),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(ALLOW_SHRINK_ENV_VAR),
    );
  });
});

describe("assertNoMalformedRows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when no row was malformed", () => {
    expect(() => assertNoMalformedRows([], false)).not.toThrow();
  });

  it("fails closed on a single malformed row, naming its URI", () => {
    const run = () =>
      assertNoMalformedRows([{ table: "uiBlocks", uri: "ds:global.." }], false);

    // The URI is the actionable part: it is how the offending row is found
    // in the source document.
    expect(run).toThrow(/ds:global\.\./);
    expect(run).toThrow(/uiBlocks/);
    expect(run).toThrow(/Malformed upstream row/);
    // The message must say what to fix, not just that something is wrong.
    expect(run).toThrow(/Fix the uri/);
    expect(run).toThrow(ALLOW_MALFORMED_ROWS_ENV_VAR);
  });

  it("names every malformed row and its table", () => {
    const run = () =>
      assertNoMalformedRows(
        [
          { table: "uiBlocks", uri: "ds:global.." },
          { table: "concepts", uri: "ds:.concept.tier" },
        ],
        false,
      );

    expect(run).toThrow(/2 row\(s\)/);
    expect(run).toThrow(/uiBlocks: "ds:global\.\."/);
    expect(run).toThrow(/concepts: "ds:\.concept\.tier"/);
  });

  it("tolerates nothing: the threshold is zero", () => {
    expect(MAX_MALFORMED_ROWS).toBe(0);
  });

  it("warns instead of throwing when the escape hatch is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      assertNoMalformedRows([{ table: "uiBlocks", uri: "ds:global.." }], true),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(ALLOW_MALFORMED_ROWS_ENV_VAR),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ds:global.."));
  });
});

describe("assertNoUnclassifiableRows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when no row was left untyped", () => {
    expect(() => assertNoUnclassifiableRows([], false)).not.toThrow();
  });

  it("throws naming the row and its table", () => {
    const run = () =>
      assertNoUnclassifiableRows(
        [{ table: "uiBlocks", uri: "ds:apps.component.spinner" }],
        false,
      );

    expect(run).toThrow("uiBlocks");
    expect(run).toThrow("ds:apps.component.spinner");
    expect(run).toThrow("no resolvable type");
  });

  it("lists every untyped row", () => {
    const run = () =>
      assertNoUnclassifiableRows(
        [
          { table: "uiBlocks", uri: "ds:apps.component.one" },
          { table: "tags", uri: "ds:tag.two" },
        ],
        false,
      );

    expect(run).toThrow("2 row(s)");
    expect(run).toThrow("ds:apps.component.one");
    expect(run).toThrow("ds:tag.two");
  });

  it("warns instead of throwing under the escape hatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      assertNoUnclassifiableRows(
        [{ table: "uiBlocks", uri: "ds:apps.component.spinner" }],
        true,
      ),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ds:apps.component.spinner"),
    );
  });

  it("names the escape hatch in the failure, so the fix is legible", () => {
    expect(() =>
      assertNoUnclassifiableRows([{ table: "tags", uri: "ds:tag.x" }], false),
    ).toThrow("SYNC_ALLOW_MALFORMED_ROWS=1");
  });
});

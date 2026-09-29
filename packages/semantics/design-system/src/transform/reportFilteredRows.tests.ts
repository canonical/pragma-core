import { afterEach, describe, expect, it, vi } from "vitest";
import reportFilteredRows, {
  FILTERED_ROWS_MARKER,
} from "./reportFilteredRows.js";

/** Table stats with `eligible` derived, so each case states only its point. */
function stats(rows: number, subjects: number, filtered = 0) {
  return { rows, filtered, eligible: rows - filtered, subjects };
}

describe("reportFilteredRows", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says nothing when the source document carries no blank rows", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    reportFilteredRows({ uiBlocks: stats(325, 325) });

    expect(log).not.toHaveBeenCalled();
  });

  it("reports the total and the per-table breakdown", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    reportFilteredRows({
      uiBlocks: stats(327, 325, 2),
      concepts: stats(34, 8, 26),
      tags: stats(44, 44),
    });

    const message = log.mock.calls[0]?.[0] as string;
    expect(message).toContain(FILTERED_ROWS_MARKER);
    expect(message).toContain("28 row(s)");
    expect(message).toContain("uiBlocks: 2");
    expect(message).toContain("concepts: 26");
    // A table that excluded nothing is not worth a line.
    expect(message).not.toContain("tags");
  });

  it("frames blank rows as routine, not as a defect", () => {
    // The wording is the point of the report: a blank row must read as
    // housekeeping so nobody goes looking for a broken sync, while a count
    // that keeps growing still reads as something to tidy.
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    reportFilteredRows({ uiBlocks: stats(326, 325, 1) });

    const message = log.mock.calls[0]?.[0] as string;
    expect(message).toContain("routine");
    expect(message).not.toMatch(/error|fail|defect/i);
  });
});

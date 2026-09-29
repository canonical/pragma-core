import type { TableSubjectStats } from "./types.js";

/**
 * Marker the sync workflow greps for to surface blank rows in the job summary.
 *
 * Stable on purpose: the workflow reads the transform's stdout rather than a
 * side-channel file, exactly as it already does for the guard failures, so the
 * one place this string is written is here.
 */
export const FILTERED_ROWS_MARKER = "Rows excluded by a row filter";

/**
 * Report the rows each table's `rowFilter` excluded.
 *
 * Excluded rows are not defects — chiefly they are rows nobody has named yet,
 * which every Coda grid accumulates because clicking into the last row creates
 * one. They must not fail the sync. But they must not be invisible either: a
 * blank row that no one can see is a blank row no one tidies, and the count
 * drifting upward is the early warning that used to arrive only as an
 * unexplained deletion count in a guard.
 *
 * Prints nothing when no row was excluded, so a clean document stays quiet.
 *
 * @param tableStats - Per-table counts from the transform.
 */
export default function reportFilteredRows(
  tableStats: Record<string, TableSubjectStats>,
): void {
  const excluded = Object.entries(tableStats)
    .filter(([, stats]) => stats.filtered > 0)
    .map(([tableName, stats]) => `${tableName}: ${stats.filtered}`);

  if (excluded.length === 0) {
    return;
  }

  const total = Object.values(tableStats).reduce(
    (sum, stats) => sum + stats.filtered,
    0,
  );

  console.log(
    `${FILTERED_ROWS_MARKER}: ${total} row(s) carried no subject and were ` +
      `skipped (${excluded.join(", ")}). This is routine — a row with no ` +
      "name is not a thing yet — but a count that keeps growing means blank " +
      "rows are accumulating in the source document.",
  );
}

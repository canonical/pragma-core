import type { DataMetrics } from "./collectDataMetrics.js";
import type { TableSubjectStats } from "./types.js";

/**
 * Fraction of committed subjects that may disappear in a single sync before
 * the transform refuses to overwrite `data/`. A drop beyond this almost
 * always means a broken extract (expired token, renamed grid, partial API
 * response), not an intentional edit.
 */
export const MAX_SUBJECT_DROP_RATIO = 0.1;

/**
 * Fraction of committed property usages (total triples) that may disappear
 * in a single sync. Tighter than the subject threshold: losing authored
 * prose (usage guidance, guidelines) shrinks triple counts long before whole
 * subjects vanish.
 */
export const MAX_PROPERTY_USAGE_DROP_RATIO = 0.05;

/**
 * Escape hatch for intentional large deletions: set this environment
 * variable to "1" (locally, or via the manual sync workflow's
 * `allow_shrink` input) to let a guarded shrink through. The guards then
 * warn instead of throwing.
 */
export const ALLOW_SHRINK_ENV_VAR = "SYNC_ALLOW_SHRINK";

/**
 * Escape hatch for a sync that must proceed with known-malformed upstream
 * rows: set this environment variable to "1" (locally, or via the manual sync
 * workflow's `allow_malformed_rows` input) to downgrade
 * {@link assertNoMalformedRows} to a warning.
 *
 * Named to match {@link ALLOW_SHRINK_ENV_VAR}, and deliberately *separate*
 * from it: allowing an intentional mass deletion must not also wave through
 * rows the source document is losing by accident.
 */
export const ALLOW_MALFORMED_ROWS_ENV_VAR = "SYNC_ALLOW_MALFORMED_ROWS";

/**
 * Malformed upstream rows tolerated per sync.
 *
 * Zero, and deliberately not configurable. A row whose `uri` is present but
 * degenerate is a defect in the source document that costs a subject on every
 * single sync until someone fixes it, and it had no fail-closed signal at all:
 * transformRow logged a warning and dropped the row, so the only downstream
 * evidence was a deletion count in a *different* guard. That is how a 23-day
 * sync outage came to read as a threshold problem instead of as rows whose
 * identity the source had lost. One malformed row now fails the sync on the
 * day it appears, naming the row.
 */
export const MAX_MALFORMED_ROWS = 0;

/**
 * An upstream row dropped because its subject URI, though present, was
 * degenerate (see classifySubjectUri.ts).
 */
export interface MalformedRow {
  /** Configured table the row came from. */
  table: string;
  /** The malformed URI verbatim, so the offending row is findable upstream. */
  uri: string;
}

/**
 * Fail when any upstream row carried a malformed subject URI.
 *
 * Fails at the cause rather than at the symptom: the row is named by its URI
 * and its table, so the fix ("this row's uri is blank/dangling in Coda") is
 * legible from the failure itself instead of being inferred from a line count
 * in the git diff.
 *
 * @param rows - Malformed rows the transform dropped.
 * @param allowMalformed - When true (the
 *   {@link ALLOW_MALFORMED_ROWS_ENV_VAR} escape hatch), warn instead of throw.
 * @throws When any row is malformed and the escape hatch is not set.
 */
export function assertNoMalformedRows(
  rows: MalformedRow[],
  allowMalformed: boolean,
): void {
  if (rows.length <= MAX_MALFORMED_ROWS) {
    return;
  }

  const detail = rows.map((row) => `${row.table}: "${row.uri}"`).join(", ");
  const summary =
    `Malformed upstream row(s): ${rows.length} row(s) have a uri that is ` +
    `present but degenerate, so their subjects are missing from the ` +
    `generated data - ${detail}`;

  if (allowMalformed) {
    console.warn(
      `${ALLOW_MALFORMED_ROWS_ENV_VAR}=1 set - allowing the sync despite: ${summary}`,
    );
    return;
  }

  throw new Error(
    `${summary}.\nFix the uri of each row named above in the source ` +
      "document: a blank or dangling reference leaves empty dot-separated " +
      "segments (e.g. `ds:global..`), which cannot be emitted as valid " +
      "Turtle, so the row is dropped and its subject disappears from " +
      `data/.\nTo sync anyway, set ${ALLOW_MALFORMED_ROWS_ENV_VAR}=1 ` +
      "(manual sync workflow: enable the allow_malformed_rows input).",
  );
}

/**
 * Fail when a row that identified itself could not be typed.
 *
 * The sibling of {@link assertNoMalformedRows}, for the other way a row with
 * real content vanishes: its identity is fine, but the class template
 * (`"class": "{type}"`) resolved to nothing because the type column is empty
 * or dangling. Such a row was dropped in total silence before this guard —
 * no warning, no count, no failure — which is the same silent-loss shape that
 * let a sync outage read as a threshold problem.
 *
 * A blank row never reaches here: rows with no name are excluded by the
 * table's `rowFilter` (see rowFilter.ts) and are not defects.
 *
 * @param rows - Identified rows the transform could not type.
 * @param allowMalformed - When true (the
 *   {@link ALLOW_MALFORMED_ROWS_ENV_VAR} escape hatch, shared with
 *   {@link assertNoMalformedRows}), warn instead of throw.
 * @throws When any row is unclassifiable and the escape hatch is not set.
 */
export function assertNoUnclassifiableRows(
  rows: MalformedRow[],
  allowMalformed: boolean,
): void {
  if (rows.length === 0) {
    return;
  }

  const detail = rows.map((row) => `${row.table}: "${row.uri}"`).join(", ");
  const summary =
    `Untypable upstream row(s): ${rows.length} row(s) have a name but no ` +
    `resolvable type, so their subjects are missing from the generated ` +
    `data - ${detail}`;

  if (allowMalformed) {
    console.warn(
      `${ALLOW_MALFORMED_ROWS_ENV_VAR}=1 set - allowing the sync despite: ${summary}`,
    );
    return;
  }

  throw new Error(
    `${summary}.\nFill in the type of each row named above in the source ` +
      "document. A row with a name is a thing the document says exists; " +
      "without a type it cannot be emitted, so its subject disappears from " +
      `data/.\nTo sync anyway, set ${ALLOW_MALFORMED_ROWS_ENV_VAR}=1 ` +
      "(manual sync workflow: enable the allow_malformed_rows input).",
  );
}

/**
 * Fail when any configured table fetched rows but produced zero subjects.
 *
 * Rows-in with no subjects-out means every row of that table failed URI or
 * class resolution — a broken mapping or a malformed extract payload. Writing
 * that output would erase the table's committed RDF wholesale.
 *
 * Measured against `eligible` (rows that passed the table's `rowFilter`),
 * never against `rows`: a table whose rows are all legitimately filtered —
 * every Concept still under the content minimum, say — has produced no
 * subjects without anything being broken, and must not be read as a failure.
 *
 * @param tableStats - Per-table row/subject counts from the transform.
 * @throws When at least one table with eligible rows yielded no subjects.
 */
export function assertTablesYieldSubjects(
  tableStats: Record<string, TableSubjectStats>,
): void {
  const broken = Object.entries(tableStats)
    .filter(([, stats]) => stats.eligible > 0 && stats.subjects === 0)
    .map(
      ([tableName, stats]) =>
        `${tableName} (${stats.eligible} eligible of ${stats.rows} rows)`,
    );

  if (broken.length > 0) {
    throw new Error(
      `Table(s) produced rows but zero subjects: ${broken.join(", ")}. ` +
        "This indicates a broken extract or table mapping - refusing to overwrite committed data.",
    );
  }
}

/**
 * Compare the staged dataset against the committed one and fail on any
 * suspicious shrink, BEFORE the committed tree is destroyed.
 *
 * Trips when, relative to the committed metrics:
 * - the subject count drops by more than {@link MAX_SUBJECT_DROP_RATIO};
 * - the number of tier subjects (= tier files) drops at all;
 * - the property-usage (triple) count drops by more than
 *   {@link MAX_PROPERTY_USAGE_DROP_RATIO}.
 *
 * A first run (nothing committed yet) never trips: all thresholds are
 * relative to zero.
 *
 * @param previous - Metrics of the committed dataset (e.g. `data/`).
 * @param next - Metrics of the freshly staged transform output.
 * @param allowShrink - When true (the {@link ALLOW_SHRINK_ENV_VAR} escape
 *   hatch), violations are logged as warnings instead of thrown.
 * @throws When a threshold is exceeded and the escape hatch is not set.
 */
export function assertNoUnexpectedShrink(
  previous: DataMetrics,
  next: DataMetrics,
  allowShrink: boolean,
): void {
  const violations: string[] = [];

  if (next.subjects < previous.subjects * (1 - MAX_SUBJECT_DROP_RATIO)) {
    violations.push(
      `subject count would drop from ${previous.subjects} to ${next.subjects} ` +
        `(more than ${MAX_SUBJECT_DROP_RATIO * 100}%)`,
    );
  }

  if (next.tiers < previous.tiers) {
    violations.push(
      `tier file count would drop from ${previous.tiers} to ${next.tiers}`,
    );
  }

  if (
    next.propertyUsage <
    previous.propertyUsage * (1 - MAX_PROPERTY_USAGE_DROP_RATIO)
  ) {
    violations.push(
      `property usage (triple count) would drop from ${previous.propertyUsage} ` +
        `to ${next.propertyUsage} (more than ${MAX_PROPERTY_USAGE_DROP_RATIO * 100}%)`,
    );
  }

  if (violations.length === 0) {
    return;
  }

  if (allowShrink) {
    console.warn(
      `${ALLOW_SHRINK_ENV_VAR}=1 set - allowing intentional shrink despite: ${violations.join("; ")}`,
    );
    return;
  }

  throw new Error(
    `Refusing to overwrite committed data:\n- ${violations.join("\n- ")}\n` +
      `If this shrink is intentional, re-run with ${ALLOW_SHRINK_ENV_VAR}=1 ` +
      "(manual sync workflow: enable the allow_shrink input).",
  );
}

import type { TableTransform } from "../config/types.js";

/**
 * Map from reference key (Coda ID or lowercase name) to resolved URI
 */
export type ReferenceMap = Map<string, string>;

/**
 * Map from Coda ID to row data for inline embedding
 */
export type InlineDataMap = Map<string, Record<string, unknown>>;

/**
 * Configuration for transforming a single table
 */
export interface TableTransformConfig extends TableTransform {
  tableName: string;
}

/**
 * Result of transforming extracted data
 */
export interface TransformResult {
  /** URIs of all subjects that were created */
  subjects: string[];
}

/**
 * Per-table row/subject counts, consumed by the fail-closed delta guards
 * (a table with rows but no subjects indicates a broken extract or mapping).
 */
export interface TableSubjectStats {
  /** Rows the extract provided for the table. */
  rows: number;
  /**
   * Rows the table's `rowFilter` excluded before transformation — rows the
   * source document carries but which are not subjects, chiefly rows with no
   * name yet. Reported rather than merely dropped, so blanks accumulating
   * upstream stay visible instead of being invisible until a guard trips.
   */
  filtered: number;
  /**
   * Rows that passed the filter and were therefore expected to yield a
   * subject. `rows - filtered`, and the correct denominator for
   * {@link assertTablesYieldSubjects}: a table all of whose rows are
   * legitimately filtered has produced no subjects without being broken.
   */
  eligible: number;
  /** Subjects the transform actually produced from those rows. */
  subjects: number;
}

/**
 * What the `uiBlocks` table holds right now.
 *
 * The plan is pure, so something has to read the document for it. This is that
 * something, and it is deliberately thin: one read, one index by the identity column,
 * and the rows as they came back so the snapshot can carry them verbatim. It takes a
 * reader rather than a `CodaProvider` so the whole plan path — including every
 * refusal — is testable against a fake with no credential and no network.
 */
import type { TableRow } from "../providers/index.js";
import type { AnatomyTable } from "./anatomyTable.js";

/** The one capability reading the document needs. */
export interface CodaReader {
  fetchTable(documentId: string, tableId: string): Promise<TableRow[]>;
}

/** One live row, reduced to the three things the write and the snapshot need. */
export interface LiveBlock {
  /** The Coda row id — how a cell is addressed for writing. */
  rowId: string;
  /** The dotted local name the identity column carries, without any `ds:` prefix. */
  uri: string;
  /** What the anatomy column says, as text. */
  anatomyDsl: string;
}

/** The table, indexed for the plan and kept whole for the snapshot. */
export interface LiveBlocks {
  /** Every row with a `uri`, by that `uri`. */
  byUri: Map<string, LiveBlock>;
  /**
   * Every row the read returned, in the order it returned them.
   *
   * Including the rows with no `uri`, which the index skips: the snapshot is what the
   * document held, and a snapshot that quietly dropped rows would restore a document
   * that is not the one it was taken from.
   */
  rows: LiveBlock[];
}

/**
 * A cell as text; a missing cell is the empty string, never `"undefined"`.
 *
 * Exported because the restore reads the same cells out of a snapshot, and two
 * readings of "what does this cell say" would be two chances to disagree.
 */
export function cell(row: TableRow, column: string): string {
  const value = row[column];
  return value === undefined || value === null ? "" : String(value);
}

/**
 * A block's dotted local name from what the identity column holds.
 *
 * The column carries the name the transform builds a subject from, which may be
 * written with or without the `ds:` prefix; both spell one block.
 */
export function blockName(value: string): string {
  return value.startsWith("ds:") ? value.slice(3) : value;
}

/** One row reduced, from either the document or a snapshot of it. */
export function toLiveBlock(row: TableRow, table: AnatomyTable): LiveBlock {
  return {
    rowId: row._codaId,
    uri: blockName(cell(row, table.uriColumn)),
    anatomyDsl: cell(row, table.anatomyColumn),
  };
}

/** Index rows by `uri`, skipping the rows that have none. */
export function indexBlocks(rows: readonly LiveBlock[]): LiveBlocks {
  const byUri = new Map<string, LiveBlock>();
  for (const row of rows) {
    // A row with no `uri` is a row the transform already skips (it would build a
    // malformed subject), so it is not a row this plan can address either.
    if (row.uri !== "") {
      byUri.set(row.uri, row);
    }
  }
  return { byUri, rows: [...rows] };
}

/**
 * Read the table.
 *
 * @note Impure — reads the document.
 */
export default async function readLiveBlocks(
  reader: CodaReader,
  table: AnatomyTable,
): Promise<LiveBlocks> {
  const rows = await reader.fetchTable(table.document, table.table);
  return indexBlocks(rows.map((row) => toLiveBlock(row, table)));
}

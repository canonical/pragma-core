/**
 * The write itself: one anatomy cell per call, then a re-read that checks it.
 *
 * Everything irreversible is here, separated from the command so the command is gates
 * and rendering and this is the API traffic. Three things about it are not
 * preferences:
 *
 *   1. **Cells are addressed by column ID.** A write keyed by a column's display name
 *      is accepted with a 202 and silently changes nothing, so the names `source.json`
 *      declares are resolved against the table's own column list first — by the same
 *      helper the roster sync resolves its columns with — and a name the table does
 *      not have refuses by name instead of writing nothing.
 *   2. **One call per cell, paced by `THROTTLE_MS`.** An unthrottled batch trips a
 *      429; the provider's backoff handles what gets through anyway.
 *   3. **The write is queued, not applied.** Coda answers 202, so the cell is not
 *      readable immediately: the apply waits `SETTLE_MS` and re-reads before it claims
 *      anything. A cell that does not come back as the file wrote it is REPORTED — the
 *      failure mode this guards against is the silent one, where the API accepted a
 *      write it never made.
 */
import { buildColumnIdMap } from "../commands/sync.js";
import type { ColumnMetadata } from "../providers/index.js";
import type { AnatomyTable } from "./anatomyTable.js";
import { SETTLE_MS, THROTTLE_MS } from "./constants.js";
import readLiveBlocks, { type CodaReader } from "./liveBlocks.js";
import { type CellUpdate, sameCell } from "./planCells.js";

/** Everything the write path calls, so one fake can stand in for all of it. */
export interface CellWriter extends CodaReader {
  fetchTableColumns(
    documentId: string,
    tableId: string,
  ): Promise<ColumnMetadata[]>;
  updateRow(
    documentId: string,
    tableId: string,
    rowId: string,
    cells: Record<string, string>,
  ): Promise<unknown>;
}

/** A cell the document did not come back holding what was written to it. */
export interface Mismatch {
  uri: string;
  rowId: string;
  /** What the write sent. */
  expected: string;
  /** What the re-read found — the empty string when the row itself is gone. */
  found: string;
}

export interface ApplyCellsInputs {
  provider: CellWriter;
  table: AnatomyTable;
  /** The updates the plan produced. */
  updates: readonly CellUpdate[];
  /** Injected so a test does not wait out the throttle once per cell. */
  sleep?: (ms: number) => Promise<void>;
}

/** What the apply did, and what the document did not take. */
export interface ApplyCellsOutcome {
  /** Write calls issued — one per cell. */
  writes: number;
  /** Cells that did not come back as they were written. */
  mismatches: Mismatch[];
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply the updates, then re-read and check every one of them.
 *
 * @note Impure — writes to the document.
 */
export default async function applyCells(
  inputs: ApplyCellsInputs,
): Promise<ApplyCellsOutcome> {
  const { provider, table, updates } = inputs;
  const sleep = inputs.sleep ?? realSleep;
  // Both columns, though only one is written: a wrong identity column would make
  // every row read as absent, and a refusal naming the column is a better answer
  // than a plan that says every authored file is stale.
  const columns = buildColumnIdMap(
    await provider.fetchTableColumns(table.document, table.table),
    [table.anatomyColumn, table.uriColumn],
  );

  let writes = 0;
  for (const update of updates) {
    await provider.updateRow(table.document, table.table, update.rowId, {
      [columns[table.anatomyColumn]]: update.after,
    });
    writes += 1;
    await sleep(THROTTLE_MS);
  }

  // The queue, waited out once rather than per cell: the reconcile is over the whole
  // batch, and what it is waiting for is the document to have caught up at all.
  await sleep(SETTLE_MS);
  const live = await readLiveBlocks(provider, table);

  const mismatches: Mismatch[] = [];
  for (const update of updates) {
    const row = live.byUri.get(update.uri);
    const found = row === undefined ? "" : row.anatomyDsl;
    if (!sameCell(found, update.after)) {
      mismatches.push({
        uri: update.uri,
        rowId: update.rowId,
        expected: update.after,
        found,
      });
    }
  }

  return { writes, mismatches };
}

/**
 * The write itself: one anatomy cell per call, then a re-read that checks it.
 *
 * Everything irreversible is here, separated from the command so the command is gates
 * and rendering and this is the API traffic. Four things about it are not
 * preferences:
 *
 *   1. **Cells are addressed by column ID.** A write keyed by a column's display name
 *      is accepted with a 202 and silently changes nothing, so the names `source.json`
 *      declares are resolved against the table's own column list first — by the same
 *      helper the roster sync resolves its columns with — and a name the table does
 *      not have refuses by name instead of writing nothing.
 *   2. **One call per cell, paced by `THROTTLE_MS`.** An unthrottled batch trips a
 *      429; the provider's backoff handles what gets through anyway.
 *   3. **The write is queued, not applied.** Coda answers 202 with a `requestId` and
 *      applies the mutation afterwards, so every write's `requestId` is kept and
 *      polled — `GET /mutationStatus/{requestId}` — until the document says
 *      `completed`, or until the poll has waited `MUTATION_TIMEOUT_MS` for it. Then,
 *      and only then, `SETTLE_MS` and the re-read: a completed mutation is still not
 *      a promise that the next read sees it.
 *   4. **A cell that does not come back as the file wrote it is REPORTED** — the
 *      failure mode this guards against is the silent one, where the API accepted a
 *      write it never made. The mutation status is carried with each report, because
 *      "the document never applied it" and "the document applied it and the cell is
 *      unchanged" are the same silence from the write's side and not the same fault.
 */
import { buildColumnIdMap } from "../commands/sync.js";
import type {
  ColumnMetadata,
  MutationStatus,
  RowUpdateResult,
} from "../providers/index.js";
import type { AnatomyTable } from "./anatomyTable.js";
import {
  MUTATION_POLL_MAX_MS,
  MUTATION_POLL_START_MS,
  MUTATION_TIMEOUT_MS,
  SETTLE_MS,
  THROTTLE_MS,
} from "./constants.js";
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
  ): Promise<RowUpdateResult>;
  getMutationStatus(requestId: string): Promise<MutationStatus>;
}

/** What became of one write's queued mutation. */
export interface Mutation {
  uri: string;
  rowId: string;
  /** The id the write came back with, or `null` when it came back without one. */
  requestId: string | null;
  /** Whether the document reported the mutation applied. */
  completed: boolean;
  /** How long the poll waited for it, in milliseconds. */
  waitedMs: number;
  /**
   * Why the poll could not get an answer, or `null` when it got one.
   *
   * A status call that fails is not allowed to take the reconcile down with it: the
   * writes have already been issued by then, and the re-read is the only thing that
   * can say what the document holds. So the failure is recorded against the mutation
   * and the apply carries on.
   */
  error: string | null;
}

/** A cell the document did not come back holding what was written to it. */
export interface Mismatch {
  uri: string;
  rowId: string;
  /** What the write sent. */
  expected: string;
  /** What the re-read found — the empty string when the row itself is gone. */
  found: string;
  /** The queued mutation this cell's write became, for the report to say why. */
  mutation: Mutation;
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
  /** One per write, in the order they were issued. */
  mutations: Mutation[];
  /** Cells that did not come back as they were written. */
  mismatches: Mismatch[];
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Follow one queued mutation until the document says it applied, or give up.
 *
 * The bound is time SLEPT, not wall clock: a test injects its sleep and asserts the
 * give-up without spending a minute, and the real run waits the real minute because
 * its sleep really sleeps. The first status is asked for before anything is waited,
 * so a mutation already applied by the time the batch ended costs one call.
 */
async function pollMutation(
  provider: CellWriter,
  mutation: Mutation,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  if (mutation.requestId === null) {
    return;
  }
  let wait = MUTATION_POLL_START_MS;
  for (;;) {
    let status: MutationStatus;
    try {
      status = await provider.getMutationStatus(mutation.requestId);
    } catch (error) {
      mutation.error = (error as Error).message;
      return;
    }
    if (status.completed) {
      mutation.completed = true;
      return;
    }
    if (mutation.waitedMs >= MUTATION_TIMEOUT_MS) {
      return;
    }
    // Clamped to what is left of the bound, so the poll waits the sixty seconds it
    // reports and not a doubling's worth more.
    const step = Math.min(wait, MUTATION_TIMEOUT_MS - mutation.waitedMs);
    await sleep(step);
    mutation.waitedMs += step;
    wait = Math.min(wait * 2, MUTATION_POLL_MAX_MS);
  }
}

/**
 * Apply the updates, follow each one's mutation, then re-read and check every one.
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

  const mutations: Mutation[] = [];
  for (const update of updates) {
    const accepted = await provider.updateRow(
      table.document,
      table.table,
      update.rowId,
      { [columns[table.anatomyColumn]]: update.after },
    );
    mutations.push({
      uri: update.uri,
      rowId: update.rowId,
      // A response without one is not a shape this API documents, but a write
      // reported as unfollowable is better than a crash inside the batch.
      requestId: accepted?.requestId ?? null,
      completed: false,
      waitedMs: 0,
      error: null,
    });
    await sleep(THROTTLE_MS);
  }

  // The queue, followed rather than guessed at: each write is asked about by its own
  // requestId, so a cell that never changes can say WHICH silence it is.
  for (const mutation of mutations) {
    await pollMutation(provider, mutation, sleep);
  }

  // And then the settle, still: `completed` is the document having applied the
  // mutation, not a promise that the next read is served the result of it.
  await sleep(SETTLE_MS);
  const live = await readLiveBlocks(provider, table);

  const mismatches: Mismatch[] = [];
  for (const [index, update] of updates.entries()) {
    const row = live.byUri.get(update.uri);
    const found = row === undefined ? "" : row.anatomyDsl;
    if (!sameCell(found, update.after)) {
      mismatches.push({
        uri: update.uri,
        rowId: update.rowId,
        expected: update.after,
        found,
        mutation: mutations[index],
      });
    }
  }

  return { writes: mutations.length, mutations, mismatches };
}

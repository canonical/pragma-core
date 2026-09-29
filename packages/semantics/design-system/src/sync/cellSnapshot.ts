/**
 * The snapshot: what every `anatomy_dsl` cell said before the write touched it.
 *
 * Taken BEFORE the first write of an apply, and it carries every live row rather than
 * only the rows the plan changes — a snapshot of the cells that were about to change
 * would not put the table back, and a reader who has to ask which rows a file covers
 * cannot trust it. It holds the row id, the `uri` and the cell, which is everything
 * `anatomies restore` needs to write the table back one cell at a time.
 *
 * It is a file on disk, in a gitignored directory: a recovery artefact, not a
 * derivation of anything in the repository, and nothing in CI reads it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AnatomyTable } from "./anatomyTable.js";
import type { LiveBlock, LiveBlocks } from "./liveBlocks.js";
import { type CellPlan, planDesiredCells } from "./planCells.js";

/** Where snapshots go, relative to the repository root. Gitignored. */
export const SNAPSHOT_DIR = "anatomies/snapshots";

/** One table's cells, as they stood. */
export interface CellSnapshot {
  /** The document the rows came from, so a snapshot cannot be replayed elsewhere. */
  document: string;
  /** The table — one, and named rather than assumed. */
  table: "uiBlocks";
  /** When it was taken, as the filename's own stamp. */
  takenAt: string;
  /** Every live row: its id, its `uri` and its cell. */
  rows: LiveBlock[];
}

/**
 * A stamp that sorts, and that two runs in one second cannot collide on.
 *
 * The colons and dots of an ISO timestamp are replaced, as the roster sync's own
 * snapshots are named: a filename with colons in it is legal here and awkward
 * everywhere else.
 */
export function snapshotStamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

/** Where a snapshot with this stamp lives. */
export function snapshotPath(stamp: string): string {
  return `${SNAPSHOT_DIR}/${stamp}-uiBlocks.json`;
}

/** The snapshot of a read. */
export function snapshotOf(
  table: AnatomyTable,
  live: LiveBlocks,
  stamp: string,
): CellSnapshot {
  return {
    document: table.document,
    table: "uiBlocks",
    takenAt: stamp,
    rows: live.rows,
  };
}

/** One row of a parsed snapshot, or nothing when it is not one. */
function row(value: unknown): LiveBlock | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.rowId !== "string" ||
    typeof candidate.uri !== "string" ||
    typeof candidate.anatomyDsl !== "string"
  ) {
    return null;
  }
  return {
    rowId: candidate.rowId,
    uri: candidate.uri,
    anatomyDsl: candidate.anatomyDsl,
  };
}

/**
 * Read a parsed snapshot, refusing anything that is not one.
 *
 * Refusing rather than guessing: this file is the input to a write, and a file that
 * is nearly a snapshot would restore nearly the right document.
 *
 * @throws when the shape is not the one {@link snapshotOf} writes.
 */
export function parseSnapshot(parsed: unknown): CellSnapshot {
  const source =
    parsed === null || typeof parsed !== "object"
      ? undefined
      : (parsed as Record<string, unknown>);
  const rows = Array.isArray(source?.rows) ? (source?.rows as unknown[]) : null;
  if (rows === null) {
    throw new Error(
      "not a snapshot: expected an object with a `rows` array of {rowId, uri, anatomyDsl}",
    );
  }
  const parsedRows = rows.map(row);
  const broken = parsedRows.indexOf(null);
  if (broken !== -1) {
    throw new Error(
      `not a snapshot: row ${broken} is not {rowId, uri, anatomyDsl} with string values`,
    );
  }
  return {
    document: typeof source?.document === "string" ? source.document : "",
    table: "uiBlocks",
    takenAt: typeof source?.takenAt === "string" ? source.takenAt : "",
    rows: parsedRows as LiveBlock[],
  };
}

/**
 * Plan a restore: the cells that differ from what the snapshot recorded.
 *
 * A row the snapshot carries with no `uri` cannot be addressed — the plan matches by
 * `uri`, because a row id is where a row happens to live — and it is no loss: a row
 * with no `uri` is not a block, so nothing ever wrote its anatomy either.
 */
export default function planRestore(
  snapshot: CellSnapshot,
  live: LiveBlocks,
  source: string,
): CellPlan {
  return planDesiredCells(
    snapshot.rows
      .filter((entry) => entry.uri !== "")
      .map((entry) => ({ uri: entry.uri, text: entry.anatomyDsl, source })),
    live,
    "restore",
  );
}

/**
 * Write a snapshot, creating its directory.
 *
 * @note Impure — writes the file system.
 */
export async function writeSnapshotFile(
  path: string,
  body: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf-8");
}

import { writeFile } from "node:fs/promises";
import type { TableRow } from "../providers/index.js";

/**
 * Write a timestamped JSON snapshot of table rows to disk before any mutation,
 * so destructive ops (row deletions) are reversible.
 *
 * @param rows - the rows to snapshot (as fetched, normalized)
 * @param path - the snapshot file path
 * @returns the path written
 * @throws if the file cannot be written (caller must abort the write run)
 * @note Impure — writes the file system.
 */
export default async function snapshotTable(
  rows: TableRow[],
  path: string,
): Promise<string> {
  await writeFile(path, JSON.stringify(rows, null, 2), "utf-8");
  return path;
}

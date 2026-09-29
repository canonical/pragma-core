import type { TableRow } from "../providers/index.js";
import { COLUMN } from "./constants.js";
import type { LiveEntry } from "./types.js";

/**
 * Reduce normalized Coda `uiBlocks` rows to the flat {@link LiveEntry} shape the
 * roster diff compares, keeping only rows whose tier is within scope.
 *
 * Pure: the rows are passed in (fetched by the caller). Lookup cells (`tier`,
 * `type`) arrive from the provider as `{ id, name }`; their display `name` is
 * extracted here. Boundary fallbacks (`?? ""`) guard against the external Coda
 * contract changing (cs:code.fallback.defensive).
 *
 * @param rows - normalized rows from `CodaProvider.fetchTable`
 * @param inScopeTiers - tier display values that are in scope
 * @returns the in-scope rows as flat entries
 */
export default function toLiveEntries(
  rows: TableRow[],
  inScopeTiers: string[],
): LiveEntry[] {
  const entries: LiveEntry[] = [];

  for (const row of rows) {
    const tier = readLookupName(row[COLUMN.tier]);
    if (!inScopeTiers.includes(tier)) {
      continue;
    }
    entries.push({
      rowId: row._codaId,
      name: readScalar(row[COLUMN.name]),
      tier,
      type: readLookupName(row[COLUMN.type]),
    });
  }

  return entries;
}

/** Read a scalar string cell, defending against a non-string external value. */
function readScalar(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Read the display `name` from a `{ id, name }` lookup cell (or a bare string). */
function readLookupName(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "name" in value) {
    const name = (value as { name: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

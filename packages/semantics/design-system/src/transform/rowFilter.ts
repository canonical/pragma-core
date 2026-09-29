import type { RowFilter } from "../config/types.js";

/**
 * Coerce a normalized cell value to a comparable/measurable string.
 *
 * The provider normalizes lookups to `{ id, name }` and strips whole-value
 * Markdown fences, so a cell is typically a string; a lookup object is reduced
 * to its `name`. Anything else stringifies. Used by the row filter to read the
 * name column and to measure a body column's length.
 *
 * @param value - The raw normalized cell value.
 * @returns The cell as a trimmed string ("" for null/undefined).
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (
    typeof value === "object" &&
    "name" in (value as Record<string, unknown>)
  ) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name.trim() : "";
  }
  return String(value).trim();
}

/**
 * Whether a row passes a table's {@link RowFilter} (logical AND over every
 * declared condition). A row is kept when every condition holds; an absent
 * filter keeps every row (the caller guards that case).
 *
 * @param row - The normalized row (column name → cell value).
 * @param filter - The include-filter to apply.
 * @returns True when the row should be emitted.
 */
export function rowPassesFilter(
  row: Record<string, unknown>,
  filter: RowFilter,
): boolean {
  const { nameIn, nonEmpty } = filter;

  if (nameIn) {
    const actual = cellText(row[nameIn.column]).toLowerCase();
    const wanted = nameIn.values.map((v) => v.trim().toLowerCase());
    if (!wanted.includes(actual)) return false;
  }

  if (nonEmpty) {
    for (const { column, minLength } of nonEmpty) {
      if (cellText(row[column]).length < (minLength ?? 1)) return false;
    }
  }

  return true;
}

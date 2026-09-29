/**
 * Coda smart-chip detection.
 *
 * Coda "smart chips" are internal row links. When a canvas/text cell is
 * serialized with `valueFormat=rich`, a chip survives as a Markdown link whose
 * target is a `coda.io` row URL, e.g.
 * `[Accordion.Item](https://coda.io/d/_dXXX#_tugrid-YYY/_rui-OEp6lXTfz2)`.
 *
 * This module is the detection half of an extraction seam: {@link SmartChip}
 * is the parsed shape and {@link detectSmartChips} recovers chips (including
 * the stable target row id) from a string WITHOUT mutating it. They are grouped
 * here because the type is the detector's own contract. What to do with the
 * detected chips — rewriting their URLs to `ds:` URIs, emitting reference edges
 * — is a separate, not-yet-implemented concern; see pragma-adrs M.01 OQ9.
 */

/**
 * A Coda smart chip (internal row link) detected inside a Markdown string.
 */
export interface SmartChip {
  /** Display text of the chip (the link label, e.g. "Accordion.Item"). */
  label: string;
  /** The full coda.io URL the chip points at. */
  url: string;
  /** The target Coda table id parsed from the URL (e.g. "grid-YYY"), or null. */
  tableId: string | null;
  /** The stable target Coda row id parsed from the URL (e.g. "i-ZZZ"), or null. */
  rowId: string | null;
}

// Markdown link whose target is a Coda internal row URL. The fragment encodes
// the table (`_tu{tableId}`) and row (`_r{rowVariant}{rowId}`); the row variant
// prefix (e.g. `ui-`) is normalised away to recover the canonical `i-` row id.
const SMART_CHIP_RE =
  /\[([^\]]+)\]\((https?:\/\/coda\.io\/[^)]*?#_tu(grid-[A-Za-z0-9_-]+)\/_r[a-z]*?(i-[A-Za-z0-9_-]+))\)/g;

/**
 * Detect Coda smart chips (internal row links) embedded in a Markdown string.
 *
 * Pure: returns the chips found, never modifies the input. Non-Coda Markdown
 * links and strings without a `coda.io` reference yield an empty array.
 *
 * @param value - The Markdown string to scan.
 * @returns The detected chips, in order of appearance.
 */
export function detectSmartChips(value: string): SmartChip[] {
  if (typeof value !== "string" || !value.includes("coda.io")) {
    return [];
  }
  const chips: SmartChip[] = [];
  for (const match of value.matchAll(SMART_CHIP_RE)) {
    chips.push({
      label: match.at(1) ?? "",
      url: match.at(2) ?? "",
      tableId: match.at(3) ?? null,
      rowId: match.at(4) ?? null,
    });
  }
  return chips;
}

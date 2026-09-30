import type { BlockType } from "./types.js";

/** Block types legal in the ontology (`ds:UIBlock` subclasses). Group/Variant/View are excluded — see M.03 D6. */
export const LEGAL_BLOCK_TYPES: readonly BlockType[] = [
  "Component",
  "Pattern",
  "Layout",
  "Subcomponent",
] as const;

/** Coda column names (with `useColumnNames=true`) the sync reads/writes on uiBlocks. */
export const COLUMN = {
  name: "name",
  tier: "tier",
  type: "type",
} as const;

/** Coda lookup tables the `tier`/`type` columns reference (needed to resolve a write payload to a rowId). */
export const LOOKUP_TABLE = {
  tiers: "grid-KdW0T6RE3B",
  uiBlockTypes: "grid-bahkR65Cvp",
} as const;

/** Delay (ms) between Coda write calls — an unthrottled batch trips HTTP 429. Backoff in the provider handles any remaining 429s. */
export const THROTTLE_MS = 1100;

/**
 * Fallback display-name → option row-id for the `tier`/`type` lookup columns,
 * for options that may not appear on any in-scope live row (so they can't be
 * learned from the fetched rows). Lookup cells MUST be written by the option's
 * row-id — writing the display string 202s but silently no-ops.
 *
 * @note doc-specific ids for Coda doc `NyzE_TLZDh` (uiBlockTypes `grid-bahkR65Cvp`).
 */
export const LOOKUP_OPTION = {
  type: {
    Subcomponent: "i-ya3Vm80Jgd",
    Component: "i-w6UO-xh8Qh",
    Pattern: "i-wXCNYtx4MM",
    Layout: "i-vlRygCVYbE",
  } as Record<string, string>,
  tier: {
    Global: "i-2bvawjqU6x",
    "Global/Form": "i-coQYYw48ct",
  } as Record<string, string>,
} as const;

/** Pause (ms) after an apply pass before re-reading — Coda's write queue is eventually consistent. */
export const SETTLE_MS = 4000;

/**
 * How long (ms) one queued mutation is followed before the poll gives up on it.
 *
 * A write is accepted with a `requestId` and applied afterwards, so "the cell did
 * not change" has two very different causes — the document never applied the
 * mutation, or it applied it and the cell still does not say what was written — and
 * only `getMutationStatus` separates them. Counted as time SLEPT rather than wall
 * clock, so the bound is the same on a fake clock as on a real one.
 */
export const MUTATION_TIMEOUT_MS = 60_000;

/** First wait (ms) between mutation-status polls; it doubles from here. */
export const MUTATION_POLL_START_MS = 500;

/** Ceiling (ms) the doubling poll interval stops at. */
export const MUTATION_POLL_MAX_MS = 8000;

/** Max apply→verify→retry passes to converge against Coda's silent write drops. */
export const RECONCILE_PASSES = 4;

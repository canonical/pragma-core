/**
 * Shared types for the Coda sync domain.
 *
 * These types describe the three artefacts the gated-write tool moves between:
 * the **target spec** (desired roster, authored by hand), the **live rows**
 * (read from Coda), and the **plan** (the CRUD operations derived by diffing the
 * two). Grouping them here keeps the spec→diff→plan pipeline's vocabulary in one
 * place, since each stage consumes the previous stage's type.
 */

/** A Coda block type that is legal in the ontology (`ds:UIBlock` subclasses). */
export type BlockType = "Component" | "Pattern" | "Layout" | "Subcomponent";

/**
 * The mutable source fields of a uiBlocks row that the roster convergence touches.
 *
 * NB: the row's `uri` is intentionally absent — it is a **computed formula column
 * in Coda** derived from `(type, name, tier)`. The sync tool writes only these
 * three source fields; Coda recomputes the URI. The URI must never be written.
 */
export interface EntryShape {
  /** Display name, e.g. `TextField`. */
  name: string;
  /** Coda tier display value, e.g. `Global` or `Global/Form`. */
  tier: string;
  /** Block type. */
  type: BlockType;
}

/** The operation kind declared for a target entry (a hint; the diff verifies it). */
export type OpKind =
  | "keep"
  | "move"
  | "rename"
  | "rename+retype"
  | "retype"
  | "merge"
  | "create";

/** One entry in the declarative target spec, keyed by Coda row id (`null` = new). */
export interface TargetEntry {
  /** Coda row id, or `null` for a row that does not yet exist (a `create`). */
  rowId: string | null;
  /** The observed current shape, when the author recorded it (documentation only). */
  current?: EntryShape;
  /** The desired shape, or `null` when the entry is to be removed (a `merge`). */
  target: EntryShape | null;
  /** Declared operation kind. */
  op: OpKind;
  /** For `merge`: the row id the merged concept folds into. */
  mergeInto?: string;
  /** Human rationale, traceable to an M.03b decision. */
  note?: string;
}

/** The scope fence: only rows in these tiers of this table may be mutated. */
export interface SyncScope {
  documentId: string;
  table: string;
  tiers: string[];
  note?: string;
}

/** The full declarative target spec file shape. */
export interface TargetSpec {
  scope: SyncScope;
  entries: TargetEntry[];
  /** Row ids explicitly out of scope — the tool must never touch these. */
  deferred?: { note?: string; rowIds: string[] };
}

/** A live uiBlocks row reduced to the fields the diff compares. */
export interface LiveEntry {
  rowId: string;
  name: string;
  tier: string;
  type: string;
}

/** A single planned CRUD operation, derived by diffing target against live. */
export interface PlannedOp {
  kind: OpKind;
  rowId: string | null;
  /** What the row looks like now (absent for `create`). */
  before: EntryShape | null;
  /** What the row should look like (absent for `merge`). */
  after: EntryShape | null;
  mergeInto?: string;
  note?: string;
  /** Fields that actually change (drives the diff view and the write payload). */
  changedFields: Array<keyof EntryShape>;
}

/** The outcome of diffing: the plan plus anything the diff flagged as unsafe. */
export interface SyncPlan {
  ops: PlannedOp[];
  /** Guardrail violations — non-empty means `--apply` is refused. */
  violations: string[];
  /** Live rows in scope that the spec does not mention (informational). */
  unmanaged: LiveEntry[];
}

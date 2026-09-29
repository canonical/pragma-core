import { CodaProvider, type TableRow } from "../providers/index.js";
import {
  COLUMN,
  LOOKUP_OPTION,
  RECONCILE_PASSES,
  SETTLE_MS,
  THROTTLE_MS,
} from "../sync/constants.js";
import diffRoster from "../sync/diffRoster.js";
import loadTargetSpec from "../sync/loadTargetSpec.js";
import renderPlan from "../sync/renderPlan.js";
import snapshotTable from "../sync/snapshotTable.js";
import toLiveEntries from "../sync/toLiveEntries.js";
import type {
  EntryShape,
  PlannedOp,
  SyncPlan,
  TargetSpec,
} from "../sync/types.js";

/** Options controlling a sync run. */
export interface SyncOptions {
  /** Path to the declarative target-spec JSON. */
  specPath: string;
  /** When false (default), the run is dry — no writes. */
  apply: boolean;
  /** Timestamp string for the snapshot filename (injected; `Date` is unavailable in some contexts). */
  stamp?: string;
}

/**
 * The gated Coda roster sync: read live rows, diff against the target spec,
 * render the plan, and (only with `apply` + zero violations) perform writes.
 *
 * This is the gated-write mechanism mandated by pragma-adrs M.03 D3. The diff is
 * always shown; `apply` is refused while any guardrail violation stands, and a
 * table snapshot is taken before any mutation so deletions are reversible.
 *
 * @param options - spec path, apply flag, and snapshot timestamp
 * @returns the computed plan (also rendered to stdout)
 * @note Impure — reads the file system, calls the Coda API, and writes to stdout.
 */
export default async function sync(options: SyncOptions): Promise<SyncPlan> {
  const spec = await loadTargetSpec(options.specPath);

  const provider = new CodaProvider();
  const rows = await provider.fetchTable(
    spec.scope.documentId,
    spec.scope.table,
  );
  const live = toLiveEntries(rows, spec.scope.tiers);

  const plan = diffRoster(spec, live);
  console.log(renderPlan(plan));

  if (options.apply) {
    if (plan.violations.length > 0) {
      throw new Error(
        `Refusing --apply: ${plan.violations.length} guardrail violation(s) must be resolved first`,
      );
    }
    const snapshotPath = `coda-snapshot-${options.stamp ?? "unstamped"}.json`;
    await snapshotTable(rows, snapshotPath);
    console.log(`\n✓ snapshot written: ${snapshotPath} (${rows.length} rows)`);

    // Coda row writes require column IDs, not display names (names silently
    // no-op — they return 202 but change nothing). Resolve name→ID up front.
    const columns = await provider.fetchTableColumns(
      spec.scope.documentId,
      spec.scope.table,
    );
    const columnId = buildColumnIdMap(columns);
    // Lookup columns (tier/type) must be written by option row-id, learned from
    // the fetched rows + a static seed for options absent from in-scope rows.
    const lookupId = buildLookupIdMap(rows);
    const finalPlan = await applyAndReconcile(
      provider,
      spec,
      plan,
      columnId,
      lookupId,
    );
    return finalPlan;
  }

  return plan;
}

/**
 * Apply the plan, then verify by re-reading and re-diffing — Coda's write API is
 * eventually consistent and silently drops a fraction of a long write burst
 * (returns 202, persists nothing). Any residual ops are retried, up to
 * {@link RECONCILE_PASSES} passes; the tool's idempotency makes re-application
 * safe (already-applied ops diff as no-change).
 *
 * @param provider - the Coda client
 * @param spec - the target spec
 * @param firstPlan - the plan from the initial diff
 * @param columnId - source-column name→id map
 * @param lookupId - tier/type display-name→option-row-id maps
 * @returns the plan after the final pass (its `ops` should be empty on success)
 * @note Impure — repeated Coda reads/writes.
 */
async function applyAndReconcile(
  provider: CodaProvider,
  spec: TargetSpec,
  firstPlan: SyncPlan,
  columnId: Record<string, string>,
  lookupId: LookupIdMap,
): Promise<SyncPlan> {
  let plan = firstPlan;
  // Target keys (name|tier|type) already issued as `create` this run. A freshly
  // created row may not be readable on the next pass's re-fetch (Coda is
  // eventually consistent), which would otherwise re-create it → duplicates.
  // Once issued, a create is suppressed in later passes; only genuinely-new
  // ops are retried.
  const createdKeys = new Set<string>();
  for (let pass = 1; pass <= RECONCILE_PASSES; pass++) {
    const applicable = plan.ops.filter(
      (op) => isPending(op) && !alreadyCreated(op, createdKeys),
    );
    if (applicable.length === 0) {
      console.log(`\n✓ reconciled — no residual ops after pass ${pass - 1}.`);
      return plan;
    }
    console.log(`\n── Apply pass ${pass} (${applicable.length} op(s)) ──`);
    await applyPlan(
      provider,
      spec,
      { ...plan, ops: applicable },
      columnId,
      lookupId,
    );
    for (const op of applicable) {
      if (op.kind === "create" && op.after) {
        createdKeys.add(shapeKey(op.after));
      }
    }

    // Let Coda's async write queue settle before re-reading.
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    const rows = await provider.fetchTable(
      spec.scope.documentId,
      spec.scope.table,
    );
    plan = diffRoster(spec, toLiveEntries(rows, spec.scope.tiers));
  }

  const residual = plan.ops.filter(
    (op) => isPending(op) && !alreadyCreated(op, createdKeys),
  ).length;
  if (residual > 0) {
    console.log(
      `\n⚠ ${residual} op(s) still unapplied after ${RECONCILE_PASSES} passes — re-run \`ds:sync --apply\` to continue.`,
    );
  }
  return plan;
}

/** Stable key for a target shape, for create-dedup across reconcile passes. */
function shapeKey(after: EntryShape): string {
  return `${after.name}|${after.tier}|${after.type}`;
}

/** Whether a create op's target was already issued this run (suppress re-create). */
function alreadyCreated(op: PlannedOp, createdKeys: Set<string>): boolean {
  return (
    op.kind === "create" &&
    op.after !== null &&
    createdKeys.has(shapeKey(op.after))
  );
}

/**
 * Whether an op still needs applying. A `create` is always pending; a `merge` is
 * pending while its row exists (`before` present); a mutate (move/rename/retype)
 * is pending only if it actually changes a field — an already-applied rename
 * re-diffs as the same op with empty `changedFields` and must count as done, or
 * the reconcile loop never converges.
 *
 * @param op - the planned op
 * @returns true if the op represents an outstanding change
 */
function isPending(op: PlannedOp): boolean {
  if (op.kind === "keep") {
    return false;
  }
  if (op.kind === "create") {
    return true;
  }
  if (op.kind === "merge") {
    return op.before !== null;
  }
  return op.changedFields.length > 0;
}

/**
 * Map column display names to their Coda column IDs.
 *
 * Exported, and the names are a parameter rather than a constant, because every write
 * against this document needs the same thing: a cell is addressed by column id, a
 * cell keyed by display name is accepted with a 202 and changes nothing, and a column
 * the table does not have must refuse rather than write nothing. The roster sync asks
 * for its three columns and the anatomy write asks for its two.
 *
 * @param columns - the table's column metadata
 * @param required - the display names to resolve. Defaults to the roster sync's three.
 * @returns a record of display name → column id
 * @throws if any required column is missing
 */
export function buildColumnIdMap(
  columns: Array<{ id: string; name: string }>,
  required: readonly string[] = [COLUMN.name, COLUMN.tier, COLUMN.type],
): Record<string, string> {
  const byName = new Map(columns.map((c) => [c.name, c.id] as const));
  const map: Record<string, string> = {};
  for (const col of required) {
    const id = byName.get(col);
    if (!id) {
      throw new Error(`Coda column "${col}" not found — cannot write`);
    }
    map[col] = id;
  }
  return map;
}

/**
 * Execute a vetted plan against Coda: non-destructive ops first (create / move /
 * rename / retype), row deletions LAST. Each op is logged. Assumes zero
 * violations and a snapshot already taken (the caller guarantees both).
 *
 * @param provider - the Coda client
 * @param spec - the target spec (for scope: documentId, table)
 * @param plan - the vetted plan
 * @note Impure — performs mutating Coda calls.
 */
export async function applyPlan(
  provider: CodaProvider,
  spec: TargetSpec,
  plan: SyncPlan,
  columnId: Record<string, string>,
  lookupId: LookupIdMap,
): Promise<void> {
  const { documentId, table } = spec.scope;
  // Partition into typed work-lists. The predicates narrow the op shape so the
  // executors receive guaranteed non-null fields — no in-executor guards needed.
  const creates = plan.ops.filter(isCreate);
  const updates = plan.ops.filter(isUpdate);
  const deletions = plan.ops.filter(isDeletion);

  // Last-resort safety: any actionable op that matched none of the three
  // executors is malformed and would be silently skipped — refuse instead.
  const classified = new Set<PlannedOp>([...creates, ...updates, ...deletions]);
  const orphan = plan.ops.find(
    (op) => op.kind !== "keep" && !classified.has(op),
  );
  if (orphan) {
    throw new Error(
      `apply: ${orphan.kind} op (rowId ${orphan.rowId}) matched no executor — refusing to silently skip it`,
    );
  }

  console.log(`\nApplying ${creates.length + updates.length} write(s)…`);
  for (const op of creates) {
    await provider.createRow(
      documentId,
      table,
      toCells(op.after, columnId, lookupId),
    );
    console.log(
      `  + created ${op.after.name} [${op.after.tier}/${op.after.type}]`,
    );
    await throttle();
  }
  for (const op of updates) {
    await provider.updateRow(
      documentId,
      table,
      op.rowId,
      toCells(op.after, columnId, lookupId),
    );
    console.log(
      `  ~ ${op.kind} ${op.after.name} [${op.after.tier}/${op.after.type}] (${op.rowId})`,
    );
    await throttle();
  }

  console.log(`\nApplying ${deletions.length} deletion(s) (last)…`);
  for (const op of deletions) {
    await provider.deleteRows(documentId, table, [op.rowId]);
    console.log(`  − deleted ${op.before.name} (${op.rowId})`);
    await throttle();
  }

  console.log("\n✓ apply complete.");
}

/** A create op: has a target shape, no row id yet. */
type CreateOp = PlannedOp & { kind: "create"; after: EntryShape };
/** An update op (move/rename/retype): has both a row id and a target shape. */
type UpdateOp = PlannedOp & { rowId: string; after: EntryShape };
/** A deletion (merge) op: has a row id and the row's prior shape. */
type DeletionOp = PlannedOp & {
  kind: "merge";
  rowId: string;
  before: EntryShape;
};

/** Narrow to a create with a non-null target (well-formed by the loader/diff). */
function isCreate(op: PlannedOp): op is CreateOp {
  return op.kind === "create" && op.after !== null;
}

/** Narrow to a row-targeted mutation (move/rename/retype) with a target shape. */
function isUpdate(op: PlannedOp): op is UpdateOp {
  return (
    op.kind !== "keep" &&
    op.kind !== "merge" &&
    op.kind !== "create" &&
    op.rowId !== null &&
    op.after !== null
  );
}

/** Narrow to a merge with the row id and prior shape needed to delete + log it. */
function isDeletion(op: PlannedOp): op is DeletionOp {
  return op.kind === "merge" && op.rowId !== null && op.before !== null;
}

/** Display-name → option row-id maps for the `tier` and `type` lookup columns. */
interface LookupIdMap {
  tier: Record<string, string>;
  type: Record<string, string>;
}

/**
 * Build the Coda cell payload for a target shape, keyed by column id.
 *
 * The `name` column is plain text (written as-is). The `tier`/`type` columns are
 * **lookups** — they must be written by the referenced option's **row-id**, not
 * its display string (the string 202s but silently no-ops). `resolveLookupValue`
 * maps each display value to its option row-id.
 *
 * @param after - the target shape to write
 * @param columnId - source-column name→id map (from `buildColumnIdMap`)
 * @param lookupId - display-name→option-row-id maps for the lookup columns
 * @returns the column-id→value cell map
 */
function toCells(
  after: EntryShape,
  columnId: Record<string, string>,
  lookupId: LookupIdMap,
): Record<string, string> {
  return {
    [columnId[COLUMN.name]]: after.name,
    [columnId[COLUMN.tier]]: resolveLookupValue("tier", after.tier, lookupId),
    [columnId[COLUMN.type]]: resolveLookupValue("type", after.type, lookupId),
  };
}

/**
 * Resolve a lookup column's display value to its Coda option row-id, throwing if
 * unresolvable — a write with an unknown lookup value would silently no-op.
 *
 * @param column - "tier" or "type"
 * @param value - the display value to resolve
 * @param lookupId - the resolved option maps
 * @returns the option row-id
 * @throws if the value maps to no option
 */
function resolveLookupValue(
  column: "tier" | "type",
  value: string,
  lookupId: LookupIdMap,
): string {
  const id = lookupId[column][value];
  if (!id) {
    throw new Error(
      `apply: cannot resolve ${column} "${value}" to a Coda option row-id (would silently no-op)`,
    );
  }
  return id;
}

/**
 * Learn display-name → option-row-id for the `tier`/`type` lookup columns from
 * the fetched rows (each lookup cell carries `{ id, name }`), then overlay the
 * static {@link LOOKUP_OPTION} seed for options absent from any in-scope row.
 *
 * @param rows - the rows already fetched from Coda (normalized)
 * @returns the lookup id maps
 */
function buildLookupIdMap(rows: TableRow[]): LookupIdMap {
  const tier: Record<string, string> = { ...LOOKUP_OPTION.tier };
  const type: Record<string, string> = { ...LOOKUP_OPTION.type };
  for (const row of rows) {
    learnLookupCell(row[COLUMN.tier], tier);
    learnLookupCell(row[COLUMN.type], type);
  }
  return { tier, type };
}

/** Record a `{ id, name }` lookup cell into the display-name → row-id map. */
function learnLookupCell(cell: unknown, into: Record<string, string>): void {
  if (
    typeof cell === "object" &&
    cell !== null &&
    "id" in cell &&
    "name" in cell
  ) {
    const { id, name } = cell as { id: unknown; name: unknown };
    if (typeof id === "string" && typeof name === "string") {
      into[name] = id;
    }
  }
}

/**
 * Pause briefly between writes to stay under Coda's API rate limit (a single
 * unthrottled batch trips HTTP 429).
 *
 * @note Impure — delays via a timer.
 */
function throttle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
}

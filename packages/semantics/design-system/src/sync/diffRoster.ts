import { LEGAL_BLOCK_TYPES } from "./constants.js";
import type {
  EntryShape,
  LiveEntry,
  PlannedOp,
  SyncPlan,
  TargetEntry,
  TargetSpec,
} from "./types.js";

/**
 * Diff a declarative target roster against the live Coda rows and derive the
 * CRUD plan, collecting guardrail violations.
 *
 * Pure: the live rows are passed in (fetched by the caller), so the same
 * (spec, liveRows) always yields the same plan — this is what makes the plan
 * reviewable and testable before any write happens.
 *
 * @param spec - the desired-state target roster
 * @param liveRows - uiBlocks rows already read from Coda
 * @returns the planned operations plus any guardrail violations and unmanaged rows
 */
export default function diffRoster(
  spec: TargetSpec,
  liveRows: LiveEntry[],
): SyncPlan {
  const liveById = new Map(liveRows.map((r) => [r.rowId, r] as const));
  const ops: PlannedOp[] = [];
  const violations: string[] = [];
  const managedIds = new Set<string>();

  for (const entry of spec.entries) {
    const op = derivePlannedOp(entry, liveById, liveRows);
    ops.push(op);
    if (entry.rowId) {
      managedIds.add(entry.rowId);
    }
    if (op.rowId) {
      managedIds.add(op.rowId);
    }
    violations.push(...findEntryViolations(entry, op, spec, liveById));
  }

  const unmanaged = liveRows.filter(
    (r) => isInScopeTier(r.tier, spec) && !managedIds.has(r.rowId),
  );

  return { ops, violations, unmanaged };
}

/**
 * Build the planned operation for one target entry by comparing it to its live row.
 */
function derivePlannedOp(
  entry: TargetEntry,
  liveById: Map<string, LiveEntry>,
  liveRows: LiveEntry[],
): PlannedOp {
  // A `create` whose target shape already exists live is satisfied — downgrade
  // it to `keep` so the reconcile loop converges (and re-runs don't duplicate).
  if (entry.op === "create" && entry.target) {
    const existing = findMatchingRow(entry.target, liveRows);
    if (existing) {
      return {
        kind: "keep",
        rowId: existing.rowId,
        before: entry.target,
        after: entry.target,
        note: entry.note,
        changedFields: [],
      };
    }
  }

  const live = entry.rowId ? liveById.get(entry.rowId) : undefined;
  const before: EntryShape | null = live
    ? {
        name: live.name,
        tier: live.tier,
        type: live.type as EntryShape["type"],
      }
    : null;
  const after = entry.target;

  return {
    kind: entry.op,
    rowId: entry.rowId,
    before,
    after,
    mergeInto: entry.mergeInto,
    note: entry.note,
    changedFields: findChangedFields(before, after),
  };
}

/** Find a live row whose name, tier, and type all match the target shape. */
function findMatchingRow(
  target: EntryShape,
  liveRows: LiveEntry[],
): LiveEntry | undefined {
  return liveRows.find(
    (r) =>
      r.name === target.name &&
      r.tier === target.tier &&
      r.type === target.type,
  );
}

/** List the {@link EntryShape} fields that differ between before and after. */
function findChangedFields(
  before: EntryShape | null,
  after: EntryShape | null,
): Array<keyof EntryShape> {
  if (!before || !after) {
    return [];
  }
  const fields: Array<keyof EntryShape> = ["name", "tier", "type"];
  return fields.filter((f) => before[f] !== after[f]);
}

/**
 * Collect guardrail violations for one entry: scope fence, type legality,
 * row-id resolution, and merge-target validity.
 */
function findEntryViolations(
  entry: TargetEntry,
  op: PlannedOp,
  spec: TargetSpec,
  liveById: Map<string, LiveEntry>,
): string[] {
  const violations: string[] = [];
  const label = entry.target?.name ?? entry.current?.name ?? entry.rowId ?? "?";

  if (isDeferred(entry.rowId, spec)) {
    violations.push(
      `${label}: row ${entry.rowId} is in the deferred set — out of scope (M.03 A10)`,
    );
  }

  if (entry.rowId && !liveById.has(entry.rowId)) {
    violations.push(
      `${label}: row id ${entry.rowId} not found in live Coda — spec is stale`,
    );
  }

  if (op.before && !isInScopeTier(op.before.tier, spec)) {
    violations.push(
      `${label}: current tier "${op.before.tier}" is outside the scope fence ${JSON.stringify(spec.scope.tiers)}`,
    );
  }
  if (op.after && !isInScopeTier(op.after.tier, spec)) {
    violations.push(
      `${label}: target tier "${op.after.tier}" is outside the scope fence ${JSON.stringify(spec.scope.tiers)}`,
    );
  }

  if (op.after && !isLegalType(op.after.type)) {
    violations.push(
      `${label}: target type "${op.after.type}" is not an ontology UIBlock subclass (M.03 D6)`,
    );
  }

  if (entry.op === "merge") {
    if (!entry.mergeInto) {
      violations.push(`${label}: merge op missing mergeInto`);
    } else if (!liveById.has(entry.mergeInto)) {
      violations.push(
        `${label}: mergeInto target ${entry.mergeInto} not found in live Coda`,
      );
    }
  }

  if (entry.op === "create" && entry.rowId !== null) {
    violations.push(`${label}: create op must have rowId null`);
  }

  // Null combinations the executors would silently skip (a mutate/merge needs a
  // rowId; a non-merge op needs a target). Flag so `--apply` never no-ops them.
  if (entry.op !== "create" && op.rowId === null) {
    violations.push(
      `${label}: ${entry.op} op has rowId null — would be silently skipped on apply`,
    );
  }
  if (entry.op !== "merge" && op.after === null) {
    violations.push(
      `${label}: ${entry.op} op has target null — would be silently skipped on apply`,
    );
  }

  // The declared op kind must agree with the actual diff (necessary conditions
  // only). A `keep` must change nothing. A mutate that DOES change something must
  // change its declared field — but an empty Δ is "already applied / satisfied"
  // (the reconcile-convergence case, gated by `isPending`), not a mis-declared op,
  // so the mutate checks fire only when there is *some* change.
  if (op.before && op.after) {
    const changed = op.changedFields;
    if (entry.op === "keep" && changed.length > 0) {
      violations.push(
        `${label}: declared keep but has ${changed.join(",")} change(s) — use the matching op`,
      );
    }
    if (changed.length > 0) {
      if (
        (entry.op === "rename" || entry.op === "rename+retype") &&
        !changed.includes("name")
      ) {
        violations.push(
          `${label}: declared ${entry.op} but the name does not change`,
        );
      }
      if (entry.op === "retype" && !changed.includes("type")) {
        violations.push(
          `${label}: declared retype but the type does not change`,
        );
      }
      if (entry.op === "move" && !changed.includes("tier")) {
        violations.push(`${label}: declared move but the tier does not change`);
      }
    }
  }

  return violations;
}

/** Whether a tier is within the spec's scope fence. */
function isInScopeTier(tier: string, spec: TargetSpec): boolean {
  return spec.scope.tiers.includes(tier);
}

/** Whether a row id is in the explicit deferred (untouchable) set. */
function isDeferred(rowId: string | null, spec: TargetSpec): boolean {
  if (!rowId || !spec.deferred) {
    return false;
  }
  return spec.deferred.rowIds.includes(rowId);
}

/** Whether a block type is an ontology-legal UIBlock subclass. */
function isLegalType(type: string): boolean {
  return (LEGAL_BLOCK_TYPES as readonly string[]).includes(type);
}

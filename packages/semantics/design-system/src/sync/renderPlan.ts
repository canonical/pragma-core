import type { PlannedOp, SyncPlan } from "./types.js";

/**
 * Render a sync plan as a human-readable before→after diff.
 *
 * Pure: returns the diff as a string (the caller decides whether to print it),
 * so it is testable without capturing stdout.
 *
 * @param plan - the plan produced by `diffRoster`
 * @returns a multi-line diff string suitable for console output
 */
export default function renderPlan(plan: SyncPlan): string {
  const lines: string[] = [];
  const actionable = plan.ops.filter((op) => op.kind !== "keep");

  lines.push(
    `Coda roster sync — ${actionable.length} change(s), ${plan.ops.length - actionable.length} unchanged`,
  );
  lines.push("");

  for (const op of plan.ops) {
    lines.push(renderOp(op));
  }

  if (plan.unmanaged.length > 0) {
    lines.push("");
    lines.push(
      `Unmanaged in-scope rows (not in spec): ${plan.unmanaged.length}`,
    );
    for (const row of plan.unmanaged) {
      lines.push(`  ? ${row.name} [${row.tier}/${row.type}] ${row.rowId}`);
    }
  }

  lines.push("");
  if (plan.violations.length > 0) {
    lines.push(
      `✗ ${plan.violations.length} guardrail violation(s) — --apply refused:`,
    );
    for (const v of plan.violations) {
      lines.push(`  ✗ ${v}`);
    }
  } else {
    lines.push("✓ no guardrail violations");
  }

  return lines.join("\n");
}

/** Render one planned operation as a single diff line. */
function renderOp(op: PlannedOp): string {
  const symbol = symbolFor(op.kind);
  if (op.kind === "keep") {
    return `  ${symbol} keep   ${op.after?.name ?? ""} [${op.after?.tier ?? ""}]`;
  }
  if (op.kind === "create") {
    return `  ${symbol} create ${op.after?.name ?? ""} [${op.after?.tier}/${op.after?.type}]${noteSuffix(op)}`;
  }
  if (op.kind === "merge") {
    return `  ${symbol} merge  ${op.before?.name ?? op.rowId} → ${op.mergeInto}${noteSuffix(op)}`;
  }
  const beforeStr = op.before
    ? `${op.before.name} [${op.before.tier}/${op.before.type}]`
    : "(missing)";
  const afterStr = op.after
    ? `${op.after.name} [${op.after.tier}/${op.after.type}]`
    : "(removed)";
  return `  ${symbol} ${op.kind.padEnd(6)} ${beforeStr} → ${afterStr}  Δ{${op.changedFields.join(",")}}${noteSuffix(op)}`;
}

/** A short glyph per op kind for the diff gutter. */
function symbolFor(kind: PlannedOp["kind"]): string {
  switch (kind) {
    case "create":
      return "+";
    case "merge":
      return "−";
    case "keep":
      return "=";
    default:
      return "~";
  }
}

/** Append the entry's note, when present. */
function noteSuffix(op: PlannedOp): string {
  return op.note ? `  — ${op.note}` : "";
}

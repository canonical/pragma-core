/**
 * The dry run's output.
 *
 * Whoever runs `--apply` reads this first and has to be able to predict the document
 * from it, so the counts come first and every cell that would change is named. The
 * before and after are a compact description — the two line counts and the first line
 * that differs — because a full corpus write would otherwise print tens of thousands
 * of lines; `--json` carries both texts in full, and `--only` is how one cell is read
 * closely before the rest follow.
 *
 * Pure: it returns the text and the caller prints it, so a test reads the output
 * instead of capturing stdout.
 */
import {
  type BindingFinding,
  renderWarningLines,
} from "../transform/tokenBindings.js";
import { type CellPlan, describeDiff } from "./planCells.js";

/** How many unchanged cells the summary names before it stops naming them. */
const SAMPLE = 5;

export interface RenderCellsInputs {
  plan: CellPlan;
  /** The law's findings and warnings, in the order the law produced them. */
  findings?: readonly BindingFinding[];
  /** Why `--apply` is refused, if it is. Empty means the write may proceed. */
  refusals: readonly string[];
  /** Whether this run intends to write. */
  apply: boolean;
  /** Lines the apply produced — the snapshot, the writes, the reconcile. */
  log?: readonly string[];
}

/** A block of lines under a heading, or nothing at all when there are none. */
function section(heading: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ["", heading, ...lines];
}

/** Why a desired cell has no row, in the words of the direction being planned. */
function missingReason(plan: CellPlan): string {
  return plan.verb === "write"
    ? "row not found in live document — the file is stale or the uri is wrong:"
    : "row not found in live document — deleted since the snapshot was taken, and a restore does not create rows:";
}

/** Render the plan. */
export default function renderCells(inputs: RenderCellsInputs): string {
  const { plan } = inputs;
  const findings = inputs.findings ?? [];
  const subject = plan.verb === "write" ? "authored" : "in the snapshot";
  const lines: string[] = [...(inputs.log ?? [])];

  // The tiers are part of the header and not a footnote: the counts below are of
  // the tiers in force, and a reader comparing them against the corpus has to see
  // straight away that this round is narrower than the law that ran over it.
  const tiers = plan.tiers === null ? "" : ` (tiers: ${plan.tiers.join(", ")})`;
  lines.push(
    plan.only === null
      ? `Anatomy cells — ${plan.verb === "write" ? "the authored anatomies" : "a snapshot"} against uiBlocks.anatomy_dsl${tiers}`
      : `Anatomy cells — ${plan.only}, one anatomy${tiers}`,
  );
  lines.push("");
  lines.push(
    `  ${subject.padEnd(14)} ${plan.considered}`,
    `  ${"unchanged".padEnd(14)} ${plan.unchanged.length}`,
    `  ${"to update".padEnd(14)} ${plan.updates.length}`,
    `  ${"missing".padEnd(14)} ${plan.missing.length}`,
  );

  const updates: string[] = [];
  for (const update of plan.updates) {
    const diff = describeDiff(update);
    updates.push(
      `  ~ ${update.uri} (row ${update.rowId}) ${diff.beforeLines} → ${diff.afterLines} lines, first differs at line ${diff.line}`,
      `      - ${diff.before}`,
      `      + ${diff.after}`,
    );
  }
  lines.push(...section("cells to update:", updates));

  lines.push(
    ...section(
      missingReason(plan),
      plan.missing.map((entry) => `  ✗ ${entry.uri} (${entry.source})`),
    ),
  );

  const unchanged = plan.unchanged.slice(0, SAMPLE).map((uri) => `  = ${uri}`);
  if (plan.unchanged.length > unchanged.length) {
    unchanged.push(`  … and ${plan.unchanged.length - unchanged.length} more`);
  }
  lines.push(...section("cells already in step:", unchanged));

  lines.push(
    ...section(
      "warnings — printed, and the run proceeds:",
      // Grouped by the anatomy that ORIGINATES each binding: the state lint fires
      // once per place it surfaces, and a plan is read by a person.
      renderWarningLines(findings),
    ),
  );
  lines.push(
    ...section(
      "findings — every one of these refuses --apply:",
      findings
        .filter((finding) => finding.severity === "finding")
        .map((finding) => `  ✗ ${finding.code} ${finding.message}`),
    ),
  );

  lines.push("");
  if (inputs.refusals.length > 0) {
    lines.push("✗ --apply refused:");
    for (const refusal of inputs.refusals) {
      lines.push(`  ✗ ${refusal}`);
    }
  } else if (inputs.apply) {
    lines.push(`✓ every gate open — ${plan.verb} applied.`);
  } else {
    lines.push(
      `✓ dry run: nothing written. Re-run with --apply to ${plan.verb}.`,
    );
  }

  return lines.join("\n");
}

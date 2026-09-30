/**
 * The transform's token-binding guard: the law, plus the inputs it needs (ADR J §8.2).
 *
 * `assertBindingsResolve` in `tokenBindings.ts` is the law and takes its inputs as
 * arguments, so it is testable without a filesystem. This module is the one place that
 * gathers those inputs — the token strata, the register, the imported registry — and
 * decides what a finding does to the transform. Both are small and both are inside the
 * enforced coverage scope; `src/commands/transform.ts` gains one call.
 *
 * Two floors are checked here as well, and they are what makes ADR §6.3's
 * "the transform fails on any parse failure" shippable before J-4 has migrated the
 * corpus. Today no literal is in the notation of §4.1, so a literal reading of that
 * sentence would refuse every transform. Instead the committed `anatomies/census.json`
 * carries `parseable` and `records`, and the guard refuses when either falls below the
 * committed number: a monotone ratchet that needs no new configuration, that reads
 * "any parse failure" exactly once J-4 raises the floor to the whole corpus, and that
 * matches §5.3's own `>=` record floor. It also runs BEFORE `collectDataMetrics`, so a
 * batch of parse failures is refused with its own message rather than surfacing as a
 * mystifying `MAX_PROPERTY_USAGE_DROP_RATIO` trip.
 *
 * One parse failure is not refused: an anatomy that does not parse is SKIPPED — the
 * derivation leaves its records out — and reported as a `Skipping …` line, as the
 * transform does for a malformed upstream row. Refusing it would let one bad cell in
 * the source document stop every other edit from syncing. It is reported on every run
 * until it parses, whether or not a register row admits it: the register is
 * regenerated from the committed corpus before each sync, so after the first run that
 * skipped it a row admits it, and a report that honoured the row would fall silent.
 */
import { STYLE_KEYS } from "@canonical/anatomy-dsl";
import { admitRegistered } from "../anatomies/admission.js";
import { type Census, readCensus } from "../anatomies/census.js";
import { readRegister } from "../anatomies/register.js";
import type { Config } from "../config/types.js";
import { NAMESPACES } from "../constants.js";
import type { GraphStore } from "../graph/index.js";
import { loadSymbolIndex, type SymbolIndex } from "./symbols.js";
import {
  assertBindingsResolve,
  type BindingFinding,
  type DeriveResult,
  hasFinding,
  type RegisterRow,
  readBindingRecords,
} from "./tokenBindings.js";

/** The dotted prefixes a style key admits, from the imported registry. */
export function tokenNamespaceOf(key: string): readonly string[] | undefined {
  return STYLE_KEYS[key]?.tokenNamespace;
}

/** The derivation's code for an anatomy that does not parse. */
const UNPARSEABLE = "X16";

/** What the guard found, and the floors it measured. */
export interface GuardResult {
  findings: BindingFinding[];
  /**
   * Every parse failure, admitted by a register row or not: one per failure, so an
   * anatomy reached through references appears once for itself and once per tree that
   * reached it. Skipped and reported on every run, never refused.
   */
  skipped: BindingFinding[];
  /** Records the graph holds. */
  records: number;
  /** The committed floors, or `null` where no census is committed yet. */
  floors: { records: number; parseable: number; anatomies: number } | null;
}

/**
 * The two committed inputs, injectable.
 *
 * They default to the files at their committed paths, which is what the transform
 * wants; passing them is how a test — and `anatomies validate`, which has just
 * regenerated them — supplies its own without reaching for a module mock or changing
 * the process's directory.
 */
export interface GuardInputs {
  symbols?: SymbolIndex;
  register?: readonly RegisterRow[];
  census?: Census | null;
}

/**
 * Run the guard over a transformed store.
 *
 * Returns what it found rather than throwing, so the caller controls the message; the
 * transform then refuses before it touches the committed dataset.
 */
export function runBindingGuard(
  store: GraphStore,
  config: Pick<Config, "allowUnboundSymbols">,
  derivation: Pick<DeriveResult, "anatomies" | "parsed">,
  inputs: GuardInputs = {},
): GuardResult {
  // The register admits a cell that does not parse and a dangling `uri:` here as it
  // does in `validate`: the transform is the same law in a different home, and a
  // registered exception that stopped the daily sync would make the register a
  // fiction. A resolution finding is admitted inside `checkBindings` already.
  const register = inputs.register ?? readRegister().rows;
  const derived = assertBindingsResolve(store, {
    symbols: inputs.symbols ?? loadSymbolIndex(),
    register,
    tokenNamespace: tokenNamespaceOf,
    allowUnboundSymbols: config.allowUnboundSymbols === true,
  });
  const reported = admitRegistered(derived, register);
  // An anatomy that does not parse is skipped rather than refused: the derivation has
  // already left its records out, and one bad cell in the source document must not
  // hold back every other edit. It is reported instead, by `guardTokenBindings`, as a
  // line the sync's run summary and pull request list. The report is taken from the
  // findings BEFORE admission, so a failure a register row admits is still named on
  // every run until it parses.
  const skipped = derived.filter((finding) => finding.code === UNPARSEABLE);
  const findings = reported.filter((finding) => finding.code !== UNPARSEABLE);
  // The floors account only for the failures no row admits: an admitted one did not
  // parse in the committed corpus either, so the census counted neither it among the
  // parseable anatomies nor its records.
  const newlySkipped = new Set(
    reported
      .filter((finding) => finding.code === UNPARSEABLE)
      .map((finding) => finding.block),
  );

  const records = readBindingRecords(store).length;
  const census = inputs.census === undefined ? readCensus() : inputs.census;
  const floors =
    census === null
      ? null
      : {
          records: census.records,
          parseable: census.parseable,
          anatomies: census.anatomies,
        };

  // The floors are a ratchet over the COMMITTED corpus, so they apply only to a run
  // that saw at least as many anatomies as the census counted. A test fixture, or a
  // scoped run, is not that corpus and must not trip a floor measured against it — the
  // guard that catches a corpus which shrank is the delta guard, and it says so.
  //
  // A newly skipped anatomy did not parse, so it counts toward the parse floor:
  // the floor catches an anatomy that stops parsing unnoticed, and a skipped one is
  // named. Its records, and those other trees reached through it, are gone as well, by
  // a number this run cannot know — the census counted them from a tree it can no
  // longer read — so the record floor is not measured on a run that skipped one.
  if (floors !== null && derivation.anatomies >= floors.anatomies) {
    if (derivation.parsed + newlySkipped.size < floors.parseable) {
      findings.push({
        code: "PARSE_FLOOR",
        severity: "finding",
        message: `${derivation.parsed} anatomies parsed, below the ${floors.parseable} that anatomies/census.json commits to — an anatomy that used to parse no longer does`,
      });
    }
    if (newlySkipped.size === 0 && records < floors.records) {
      findings.push({
        code: "RECORD_FLOOR",
        severity: "finding",
        message: `${records} token binding records derived, below the ${floors.records} that anatomies/census.json commits to`,
      });
    }
  }

  return { findings, skipped, records, floors };
}

/** A block's dotted local name, which is what the source document shows. */
function localName(iri: string): string {
  return iri.replace(NAMESPACES.ds, "");
}

/**
 * One `Skipping …` line per anatomy the guard skipped.
 *
 * The prefix is the contract: the sync workflow lists every log line that starts with
 * `Skipping` in its run summary and in the sync pull request, beside the rows the
 * transform left out. A parse error spans several lines, so only its first is kept —
 * the line has to stay one line to be listed whole.
 */
export function renderSkippedAnatomies(
  skipped: readonly BindingFinding[],
): string[] {
  const byBlock = new Map<string, { error: string; reachedFrom: string[] }>();
  for (const finding of skipped) {
    const block = finding.block as string;
    const entry = byBlock.get(block) ?? {
      error: finding.message.slice(finding.message.indexOf(" — ") + 3),
      reachedFrom: [],
    };
    if (finding.reachedFrom !== undefined) {
      entry.reachedFrom.push(localName(finding.reachedFrom));
    }
    byBlock.set(block, entry);
  }
  return [...byBlock.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([block, entry]) => {
      const through =
        entry.reachedFrom.length === 0
          ? ""
          : `, and those ${entry.reachedFrom.sort().join(", ")} reach through it,`;
      return (
        `Skipping the anatomy of ${localName(block)} — it does not parse, so its ` +
        `token bindings${through} are left out of data/: ${entry.error.split("\n")[0]}`
      );
    });
}

/** Print a guard's findings, warnings included, in a stable order. */
export function renderFindings(findings: readonly BindingFinding[]): string {
  if (findings.length === 0) {
    return "✓ token bindings: no findings";
  }
  const lines = [...findings]
    .sort((left, right) => left.message.localeCompare(right.message))
    .map(
      (finding) =>
        `  ${finding.severity === "finding" ? "✗" : "⚠"} [${finding.code}] ${finding.message}`,
    );
  const findingCount = findings.filter(
    (finding) => finding.severity === "finding",
  ).length;
  const warningCount = findings.length - findingCount;
  return [
    `token bindings — ${findingCount} finding(s), ${warningCount} warning(s):`,
    ...lines,
  ].join("\n");
}

/**
 * The transform's contract: refuse on a finding, report a skipped anatomy, print
 * warnings and continue.
 *
 * @throws when any finding is of severity `finding`.
 */
export default function guardTokenBindings(
  store: GraphStore,
  config: Pick<Config, "allowUnboundSymbols">,
  derivation: Pick<DeriveResult, "anatomies" | "parsed">,
  inputs: GuardInputs = {},
): GuardResult {
  const result = runBindingGuard(store, config, derivation, inputs);
  for (const line of renderSkippedAnatomies(result.skipped)) {
    console.warn(line);
  }
  if (result.findings.length > 0) {
    console.log(renderFindings(result.findings));
  }
  if (hasFinding(result.findings)) {
    throw new Error(
      "Refusing to overwrite committed data: the token-binding guard reported " +
        `${result.findings.filter((finding) => finding.severity === "finding").length} finding(s). ` +
        "Register the exception in anatomies/register.yaml, or set allowUnboundSymbols " +
        "in source.json for the migration window (never committed).",
    );
  }
  return result;
}

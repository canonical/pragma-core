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
 */
import { STYLE_KEYS } from "@canonical/anatomy-dsl";
import { admitRegistered } from "../anatomies/admission.js";
import { type Census, readCensus } from "../anatomies/census.js";
import { readRegister } from "../anatomies/register.js";
import type { Config } from "../config/types.js";
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

/** What the guard found, and the floors it measured. */
export interface GuardResult {
  findings: BindingFinding[];
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
  const findings = admitRegistered(
    assertBindingsResolve(store, {
      symbols: inputs.symbols ?? loadSymbolIndex(),
      register,
      tokenNamespace: tokenNamespaceOf,
      allowUnboundSymbols: config.allowUnboundSymbols === true,
    }),
    register,
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
  if (floors !== null && derivation.anatomies >= floors.anatomies) {
    if (derivation.parsed < floors.parseable) {
      findings.push({
        code: "PARSE_FLOOR",
        severity: "finding",
        message: `${derivation.parsed} anatomies parsed, below the ${floors.parseable} that anatomies/census.json commits to — an anatomy that used to parse no longer does`,
      });
    }
    if (records < floors.records) {
      findings.push({
        code: "RECORD_FLOOR",
        severity: "finding",
        message: `${records} token binding records derived, below the ${floors.records} that anatomies/census.json commits to`,
      });
    }
  }

  return { findings, records, floors };
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
 * The transform's contract: refuse on a finding, print warnings and continue.
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

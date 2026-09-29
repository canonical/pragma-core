/**
 * `anatomies validate [--write-register]` — the law's command-line surface, and the
 * single writer of `anatomies/register.yaml` and `anatomies/census.json` (ADR J §5.3).
 *
 * The law itself is `assertBindingsResolve` in `src/transform/tokenBindings.ts`, one
 * implementation for all three callers. What this module adds is the two files: it
 * classifies every unresolved element into a register category, regenerates the
 * register with the hand-written rationale preserved, rewrites the census from the same
 * run, and then runs the law over the result.
 *
 * Under `--write-register` the resolution- and namespace-derived rows are regenerated
 * *before* the check, so those rows hold by construction and **the gate is the diff
 * that follows** — `git diff --exit-code anatomies/census.json` in `ci.yml`'s
 * `census-drift` job. Every other row still fails. The register itself is not committed
 * while the retired notation dominates it, so the census's per-category counts and its
 * `unresolved` list are what that diff sees move; `register.ts` says why.
 */
import { tokenNamespaceOf } from "../transform/bindingGuard.js";
import {
  loadPlatformVariables,
  loadSymbolIndex,
  STATE_DERIVATIONS,
  type SymbolIndex,
} from "../transform/symbols.js";
import {
  type BindingFinding,
  type BindingRecord,
  checkBindings,
  deriveBindingRecords,
  exitCodeFor,
  NAMESPACE_CATEGORY,
  type RegisterRow,
} from "../transform/tokenBindings.js";
import {
  admitRegistered,
  classifyParseFailure,
  danglingReference,
} from "./admission.js";
import { CENSUS_PATH, type Census, readCensus, writeCensus } from "./census.js";
import { type Corpus, DATA_DIR, readCorpus } from "./corpus.js";
import {
  type CategoryCount,
  mergeRationale,
  REGISTER_PATH,
  type Register,
  readRegister,
  writeRegister,
} from "./register.js";

/**
 * Every category the register carries, so a count of 0 is a row and not an absence.
 *
 * Each is a fact about the corpus against the token graph. The categories that were a
 * fact about a reference stylesheet — leaked CSS, a focus state the graph lacks, a
 * spelling that resolves but is suspect, an anatomy with no reference — are gone with
 * the derivation that read the stylesheets: the anatomies are written by hand from the
 * implementations, and that judgement is exercised in the file, not counted here.
 */
export const CATEGORIES: readonly string[] = [
  "X1",
  "X2",
  "X5",
  "X7",
  "X8",
  "X10",
  "X11",
  "X14",
  "X15",
  "X16",
];

/**
 * Why a category is empty, where this repository cannot yet produce its rows.
 *
 * Each is a category whose input is a token-side check that arrives with a later step.
 * Naming the reason is the point: §5.3 requires a count or a one-line reason, so a
 * category that is empty because nothing can fill it reads differently from one that
 * is empty because the corpus is clean.
 */
export const EMPTY_REASONS: Record<string, string> = {
  X10: "the definitions' type/description agreement is the token side's check and lands with the Coda projection",
  X14: "the build-versus-resolver discrepancy is KNOWN_CHANNELS's uncovered rows, which token-ontology exports no reader for",
  X16: "no ds:anatomyDsl cell fails to parse",
};

/** The classification of an element that resolves in neither S1 nor S2. */
export function classifyUnresolved(
  symbol: string,
  symbols: SymbolIndex,
  computedStateVariables: ReadonlySet<string>,
): string {
  const segments = symbol.split(".");

  // X15 — a computed state variable consumed. `hover.color.foreground.secondary` is
  // S4's `--hover--color-foreground-secondary`, kept as consumed by §5.1 step 5d case
  // (ii). Checked against S4 rather than against the spelling, so a symbol that merely
  // begins with `hover` is not mistaken for one.
  if (STATE_DERIVATIONS.includes(segments[0])) {
    const variable = `--${segments[0]}--${segments.slice(1).join("-")}`;
    if (computedStateVariables.has(variable)) {
      return "X15";
    }
  }

  if (segments[0] === "modifier" || segments[0] === "surface") {
    const base = segments.slice(1).join(".");
    // X5 — a state variant consumed as a channel: `modifier.color.text.disabled`, whose
    // channel exists but whose state does not.
    const withoutState = segments.slice(1, -1).join(".");
    if (
      withoutState !== "" &&
      (symbols.names.has(withoutState) ||
        symbols.names.has(`${segments[0]}.${withoutState}`))
    ) {
      return "X5";
    }
    // X7 — a channel with no symbol: `modifier.surface`, whose base names nothing.
    if (!symbols.names.has(base)) {
      return "X7";
    }
    return "X5";
  }

  // X1 versus X2 — is the namespace itself absent, or does it exist with no member
  // that fits? The namespace is the element's first segment, and it exists when any
  // declared symbol shares it.
  const namespace = `${segments[0]}.`;
  for (const name of symbols.names) {
    if (name.startsWith(namespace)) {
      return "X2";
    }
  }
  return "X1";
}

/**
 * The retired path notation: slash-delimited, with or without the trailing `?` marker.
 *
 * `color/text/muted` and `shadow/card?` are retired; `color.text.muted` is a symbol
 * and `1 / -1` is a grid line, and neither matches. The parser refuses the notation
 * outright, which is what X16's `retired-slash-path` counts; the skill's own examples
 * are held to the same expression in `skill.tests.ts`.
 */
export const RETIRED_PATH = /^[A-Za-z0-9-]+(\/[A-Za-z0-9-]+)+\??$/;

/** A register row for an unresolved element, at the binding that consumes it. */
function unresolvedRow(
  record: BindingRecord,
  category: string,
  date: string,
): RegisterRow {
  return {
    // The element is registered where it appears, so a reader can go from the row to
    // the binding. The whole binding is named, `viaBlock` excepted: the exception is
    // about the element and the key, not about which tree reached it.
    uri: record.block.split("/").pop() as string,
    node: record.node,
    key: record.styleKey,
    state: record.styleState,
    value: record.symbol,
    category,
    considered: [],
    date,
  };
}

/** What a validation run produced. */
export interface ValidateResult {
  findings: BindingFinding[];
  exitCode: number;
  register: Register;
  census: Census;
  corpus: Corpus;
  records: BindingRecord[];
  /** Anatomies that parsed. */
  parsed: number;
  /** Whether the two committed files were rewritten. */
  wrote: boolean;
}

export interface ValidateOptions {
  /** The directory of Turtle to validate. Defaults to the committed `data/`. */
  dataDir?: string;
  /** Regenerate `anatomies/register.yaml` and `anatomies/census.json`. */
  writeRegister?: boolean;
  /** One anatomy only, by dotted local name. */
  only?: string;
  /** Injected for tests; defaults to the committed paths. */
  registerPath?: string;
  censusPath?: string;
  /** The date mechanical fields carry. Injected so a run is reproducible. */
  date?: string;
}

/**
 * Validate the corpus, and — under `writeRegister` — regenerate the two committed
 * files from the same run.
 */
export default function validateAnatomies(
  options: ValidateOptions = {},
): ValidateResult {
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const corpus = readCorpus(options.dataDir);
  const entries =
    options.only === undefined
      ? corpus.entries
      : corpus.entries.filter((entry) => entry.uri === options.only);
  if (options.only !== undefined && entries.length === 0) {
    throw new Error(
      `no non-empty anatomy named ${options.only} in ${options.dataDir ?? DATA_DIR}`,
    );
  }

  const anatomies = new Map(
    entries.map((entry) => [entry.block, entry.anatomyDsl]),
  );
  const blocks = new Set(corpus.store.getSubjects());
  const derivation = deriveBindingRecords(anatomies, blocks);

  const symbols = loadSymbolIndex();
  const computedStateVariables = new Set(
    [...loadPlatformVariables().values()]
      .filter((variable) => variable.derivation !== undefined)
      .map((variable) => variable.variable),
  );

  // The rows this run can derive. Under `--write-register` they replace what is on
  // disk; otherwise they are computed anyway, so the census's `unresolved` list and the
  // per-category counts are the same numbers either way.
  const derived: RegisterRow[] = [];
  for (const record of derivation.records) {
    if (!symbols.names.has(record.symbol)) {
      derived.push(
        unresolvedRow(
          record,
          classifyUnresolved(record.symbol, symbols, computedStateVariables),
          date,
        ),
      );
    }
    const admitted = tokenNamespaceOf(record.styleKey);
    if (
      admitted !== undefined &&
      admitted.length > 0 &&
      !admitted.some((prefix) => record.symbol.startsWith(prefix))
    ) {
      derived.push(unresolvedRow(record, NAMESPACE_CATEGORY, date));
    }
  }
  for (const finding of derivation.findings) {
    if (finding.code === "X11") {
      derived.push({
        uri: (finding.block as string).split("/").pop() as string,
        node: null,
        key: null,
        state: null,
        value: danglingReference(finding.message),
        category: "X11",
        considered: [],
        date,
      });
    }
    if (finding.code === "X16") {
      derived.push({
        uri: (finding.block as string).split("/").pop() as string,
        node: null,
        key: null,
        state: null,
        value: classifyParseFailure(finding.message),
        category: "X16",
        considered: [],
        date,
      });
    }
  }

  const existing = readRegister(options.registerPath);
  const rows = dedupe(mergeRationale(derived, existing.rows));
  const categories = countCategories(rows);
  const nextRegister: Register = { categories, rows };

  const unresolved = [
    ...new Set(
      rows
        .filter((row) => ["X1", "X2", "X5", "X7", "X15"].includes(row.category))
        .map((row) => row.value),
    ),
  ].sort();

  const nextCensus: Census = {
    anatomies: entries.length,
    parseable: derivation.parsed,
    records: derivation.records.length,
    unparseableFiles: corpus.unparseable.length,
    symbols: symbols.names.size,
    unresolved,
    categories: Object.fromEntries(
      Object.entries(categories).map(([code, entry]) => [code, entry.count]),
    ),
  };

  if (options.writeRegister === true) {
    writeRegister(nextRegister, options.registerPath);
    writeCensus(nextCensus, options.censusPath);
  }

  // Under `--write-register` the law reads the rows this run just derived, so the
  // resolution and namespace rows hold by construction and the diff is the gate.
  // Otherwise it reads what is committed, and a missing or stale row fails.
  const register = options.writeRegister === true ? rows : existing.rows;
  const findings = [
    ...admitRegistered(derivation.findings, register),
    ...checkBindings(derivation.records, {
      symbols,
      register,
      tokenNamespace: tokenNamespaceOf,
    }),
    ...censusFloorFindings(nextCensus, options),
    ...unparseableFindings(corpus),
  ];

  return {
    findings,
    exitCode: exitCodeFor(findings),
    register: nextRegister,
    census: nextCensus,
    corpus,
    records: derivation.records,
    parsed: derivation.parsed,
    wrote: options.writeRegister === true,
  };
}

/**
 * A warning per Turtle file that does not parse.
 *
 * A WARNING rather than a finding, and the reasoning is worth stating. The file is a
 * defect in this repository — the transform wrote it — so the instinct is to fail
 * closed. But the remedy is a re-emission and a re-sync, which is nobody's next
 * command while they are validating anatomies, and a finding here would stop the
 * daily pull sync and the register-drift gate on a file neither of them touches. So
 * it is printed by name, counted in the census, and left for the emitter to fix: the
 * count moving is a diff, and a diff is the signal.
 */
function unparseableFindings(corpus: Corpus): BindingFinding[] {
  return corpus.unparseable.map((entry) => ({
    code: "TTL_PARSE",
    severity: "warning" as const,
    message: `${entry.file} is not parseable Turtle, so its subjects are missing from every count below — ${entry.message}`,
  }));
}

/** One row per identity: a duplicate would make the preservation ambiguous. */
function dedupe(rows: readonly RegisterRow[]): RegisterRow[] {
  const seen = new Map<string, RegisterRow>();
  for (const row of rows) {
    const key = [
      row.uri,
      row.node,
      row.key,
      row.state,
      row.value,
      row.category,
    ].join("|");
    if (!seen.has(key)) {
      seen.set(key, row);
    }
  }
  return [...seen.values()];
}

/** Every declared category with its count, and a reason where the count is 0. */
function countCategories(
  rows: readonly RegisterRow[],
): Record<string, CategoryCount> {
  const counts: Record<string, CategoryCount> = {};
  for (const code of CATEGORIES) {
    const count = rows.filter((row) => row.category === code).length;
    counts[code] =
      count > 0
        ? { count }
        : {
            count: 0,
            reason: EMPTY_REASONS[code] ?? "no instance in the corpus",
          };
  }
  return counts;
}

/**
 * The record floor, §5.3's last-but-one row: fewer records than the committed census
 * counts is a finding. A floor, `>=`, never equality — and under `--write-register` the
 * census has just been regenerated, so a count that moved is a diff and not a finding.
 */
function censusFloorFindings(
  next: Census,
  options: ValidateOptions,
): BindingFinding[] {
  if (options.writeRegister === true) {
    return [];
  }
  const committed = readCensus(options.censusPath);
  if (committed === null || next.records >= committed.records) {
    return [];
  }
  return [
    {
      code: "RECORD_FLOOR",
      severity: "finding",
      message: `${next.records} records, below the ${committed.records} that ${CENSUS_PATH} commits to`,
    },
  ];
}

/** Render a validation run the way `validate` prints it. */
export function renderValidateResult(result: ValidateResult): string {
  const findings = result.findings.filter(
    (finding) => finding.severity === "finding",
  );
  const warnings = result.findings.filter(
    (finding) => finding.severity === "warning",
  );
  const lines = [
    `Corpus: ${result.census.anatomies} non-empty anatomies, ${result.parsed} parse, ${result.census.records} records`,
    `Symbols: ${result.census.symbols} declared, ${result.census.unresolved.length} elements admitted by the register`,
    `Register: ${result.register.rows.length} rows${result.wrote ? ` (rewrote ${REGISTER_PATH} and ${CENSUS_PATH})` : ""}`,
    "",
    ...[...findings, ...warnings]
      .sort((left, right) => left.message.localeCompare(right.message))
      .map(
        (finding) =>
          `  ${finding.severity === "finding" ? "✗" : "⚠"} [${finding.code}] ${finding.message}`,
      ),
    "",
    findings.length === 0
      ? `✓ ${warnings.length} warning(s), 0 findings`
      : `✗ ${findings.length} finding(s), ${warnings.length} warning(s)`,
  ];
  return lines.join("\n");
}

export { classifyParseFailure, danglingReference };

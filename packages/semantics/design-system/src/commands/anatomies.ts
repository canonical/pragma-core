/**
 * `bun src/cli.ts anatomies <subcommand>` — the anatomies' command line.
 *
 *   validate [--write-register] [--only <uri>] the law over the corpus, and the single
 *                                              writer of anatomies/register.yaml and
 *                                              anatomies/census.json.
 *   validate --authored [--tier <name>]        the law over the authored files, offline,
 *                                              over the tiers named or over all of them.
 *   write [--apply] [--only <uri>]             the authored files into the document's
 *        [--tier <name>]                       `anatomy_dsl` cells, for the tiers named.
 *   restore <snapshot> [--apply]               a snapshot of those cells, put back.
 *
 * Dry by default, as `sync` is: `validate --write-register` writes the register and
 * the census, and `write`/`restore` write to the document only under `--apply` and
 * only when every gate is open. Nothing here writes `data/`, which is the Coda pull
 * sync's alone, and nothing here writes `anatomies/authored/`, which is written by
 * hand from the implementations and reviewed as files.
 *
 * **The discipline for the write, and why each part of it is there.**
 *
 *   1. The document is the source of record for the anatomies. The write sends a
 *      reviewed file to the cell it belongs in; it never invents a row, and it never
 *      touches any other column — the roster of blocks, their names, tiers and types
 *      are the pull sync's and a human editor's.
 *   2. It runs on `CODA_WRITE_TOKEN`, for its READS as well as its writes, and never
 *      on `CODA_API_KEY`. That is what keeps the credential CI holds read-only and
 *      un-escalatable by any code path that reaches for a write.
 *   3. `--apply` is refused, each reason on its own line, when `CI` is set (the write
 *      is an act with a human reading the plan, never a pipeline step), when the token
 *      is unset, when the law reports a finding (a warning prints and the run
 *      proceeds), when an authored file names no live row, and when the plan is empty
 *      — nothing to do is not an apply.
 *   4. The order under `--apply` is snapshot, write, re-read, reconcile. The snapshot
 *      is every live row, taken before the first write, so the whole table can be put
 *      back; the re-read is because Coda answers 202 and a write it never made would
 *      otherwise be reported as a success.
 *   5. The canary comes first: `--only <uri>` writes one anatomy, and the rest follow
 *      once that cell has been read in the document. `--tier <name>` is the same
 *      instinct a tier at a time — the round that writes the top-level tiers names
 *      them and leaves the second-level ones authored but unsent — and the two
 *      compose, `--only` picking one anatomy out of the tiers in force. The LAW is
 *      never narrowed by either: it runs over every authored file, because a corpus
 *      is lawful or not as a whole and writing a different anatomy out of it does
 *      not make an unregistered symbol lawful. Only the plan is narrowed, and its
 *      counts and its header say which tiers they are of.
 *   6. Where it writes comes from `source.json` and nowhere else — the same root
 *      configuration, read through the same `validateConfig`, that `extract`,
 *      `transform` and the pull sync read. There is no second configuration file for
 *      this write to disagree with the sync about.
 */
import { readFile } from "node:fs/promises";
import readAuthored, {
  AUTHORED_DIR,
  type AuthoredAnatomy,
  readAuthoredTiers,
  tierOf,
} from "../anatomies/authored.js";
import validateAnatomies, {
  renderValidateResult,
} from "../anatomies/validate.js";
import { CodaProvider } from "../providers/index.js";
import readAnatomyTable, {
  type AnatomyTable,
  UnconfiguredAnatomiesError,
} from "../sync/anatomyTable.js";
import applyCells, {
  type CellWriter,
  type Mismatch,
} from "../sync/applyCells.js";
import planRestore, {
  parseSnapshot,
  snapshotOf,
  snapshotPath,
  snapshotStamp,
  writeSnapshotFile,
} from "../sync/cellSnapshot.js";
import checkAuthored from "../sync/checkAuthored.js";
import readLiveBlocks, { type LiveBlocks } from "../sync/liveBlocks.js";
import planCells, { type CellPlan } from "../sync/planCells.js";
import renderCells from "../sync/renderCells.js";
import {
  type BindingFinding,
  hasFinding,
  renderWarningLines,
} from "../transform/tokenBindings.js";

/** The subcommands, so an unknown one is named against a closed roster. */
export const SUBCOMMANDS = ["validate", "write", "restore"] as const;
export type Subcommand = (typeof SUBCOMMANDS)[number];

export interface AnatomiesOptions {
  subcommand: string;
  json?: boolean;
  writeRegister?: boolean;
  /** `validate`: run the law over the authored files instead of `data/`. */
  authored?: boolean;
  only?: string;
  /**
   * `--tier`, every occurrence of it: the tiers this run covers, or undefined for
   * all of them. `write` narrows its plan to them and `validate --authored` narrows
   * which files it reads; an empty list is a `--tier` with no name after it, and is
   * refused rather than read as "no tiers" or as "all of them".
   */
  tiers?: readonly string[];
  /** The directory of Turtle to read. Defaults to the committed `data/`. */
  dataDir?: string;
  /** `write` and `restore`: write to the document. Dry without it. */
  apply?: boolean;
  /** `restore`: the snapshot to put back. */
  snapshot?: string;
  /** Injected seams. Each defaults to the committed path or the real thing. */
  authoredDir?: string;
  /** The root configuration to read. Defaults to the committed `source.json`. */
  sourcePath?: string;
  registerPath?: string;
  env?: Record<string, string | undefined>;
  provider?: CellWriter;
  sleep?: (ms: number) => Promise<void>;
  /** The stamp the snapshot filename carries. Defaults to the clock. */
  stamp?: string;
  /** Injected so a test asserts the snapshot's content without a real file. */
  writeSnapshot?: (path: string, body: string) => Promise<void>;
  /** Injected so a test hands `restore` a snapshot without a real file. */
  readFileText?: (path: string) => Promise<string>;
}

/** What the run produced, and the exit code the caller should use. */
export interface AnatomiesResult {
  exitCode: number;
  /** What was printed, so a test reads the output rather than a spy. */
  output: string;
  /** The plan, for `write` and `restore`; null when the run refused before one. */
  plan?: CellPlan | null;
}

/**
 * `validate --authored`: the law over the authored files, offline.
 *
 * The same check the write runs before it plans, without the document: an author
 * needs to know that a file is lawful before there is anything to send, and the
 * write's dry run cannot say so without the write token. Findings and warnings
 * render as the write renders them; a finding is exit 1, as it is everywhere else.
 *
 * `--tier` here narrows which files are READ, which is the opposite of what it does
 * to the write: an author has one tier open and wants that tier's answer, and there
 * is no document in this path for a narrow check to leave half-written.
 */
function validateAuthored(options: AnatomiesOptions): AnatomiesResult {
  const dir = options.authoredDir ?? AUTHORED_DIR;
  const tiers = options.tiers;
  const rejected = tierRefusal(tiers, readAuthoredTiers(dir), dir);
  if (rejected !== null) {
    return rejected;
  }
  const authored = readAuthored(dir, tiers);
  if (authored.length === 0) {
    return refuse(`No authored anatomy in ${dir}.`);
  }
  const findings = checkAuthored(authored, {
    dataDir: options.dataDir,
    registerPath: options.registerPath,
  });
  const exitCode = hasFinding(findings) ? 1 : 0;
  if (options.json === true) {
    return {
      exitCode,
      output: JSON.stringify(
        {
          exitCode,
          tiers: tiers === undefined ? null : [...tiers],
          authored: authored.map((entry) => entry.uri),
          findings,
        },
        null,
        2,
      ),
    };
  }
  // The state lint fires once per place a binding surfaces, which over the authored
  // corpus is hundreds of lines about the same few origins, so the warnings print
  // grouped by the anatomy that wrote each binding. Findings are never grouped.
  const warnings = renderWarningLines(findings);
  const errors = findings
    .filter((finding) => finding.severity === "finding")
    .map((finding) => `  ✗ ${finding.code} ${finding.message}`);
  return {
    exitCode,
    output: [
      `Authored: ${authored.length} anatomy/anatomies in ${dir}${
        tiers === undefined ? "" : ` (tiers: ${tiers.join(", ")})`
      }`,
      ...(warnings.length > 0 ? ["", "warnings:", ...warnings] : []),
      ...(errors.length > 0 ? ["", "findings:", ...errors] : []),
      "",
      exitCode === 0
        ? `✓ ${warnings.length} warning(s), 0 findings — every file is lawful`
        : `✗ ${errors.length} finding(s), ${warnings.length} warning(s)`,
    ].join("\n"),
  };
}

/** `validate`: the law, and — with `--write-register` — the two committed files. */
export function validate(options: AnatomiesOptions): AnatomiesResult {
  if (options.authored === true) {
    return validateAuthored(options);
  }
  const result = validateAnatomies({
    dataDir: options.dataDir,
    writeRegister: options.writeRegister,
    only: options.only,
  });
  return {
    exitCode: result.exitCode,
    output:
      options.json === true
        ? JSON.stringify(
            {
              exitCode: result.exitCode,
              census: result.census,
              findings: result.findings,
            },
            null,
            2,
          )
        : renderValidateResult(result),
  };
}

/** A refusal that stops the run before a plan can be made. */
function refuse(output: string): AnatomiesResult {
  return { exitCode: 1, plan: null, output };
}

/**
 * What a `--tier` set earns when it names a tier the authored corpus has not got,
 * or names nothing at all — and `null` when it is a set the run can honour.
 *
 * A tier that matches no file is a refusal rather than a narrowing to nothing, for
 * the reason `--only` is: a misspelt name that silently planned zero cells reads
 * exactly like a corpus already in step, and the run would report success for work
 * it never considered.
 */
function tierRefusal(
  tiers: readonly string[] | undefined,
  present: readonly string[],
  dir: string,
): AnatomiesResult | null {
  if (tiers === undefined) {
    return null;
  }
  if (tiers.length === 0) {
    return refuse(
      `--tier needs a tier name. It takes one per occurrence or a comma-separated list, each naming a directory under ${dir} — ${present.join(", ")}.`,
    );
  }
  const absent = tiers.filter((tier) => !present.includes(tier));
  if (absent.length === 0) {
    return null;
  }
  return refuse(
    `No authored anatomy in tier ${absent.join(", ")}. --tier names a directory under ${dir}, which is the first dotted segment of every uri in it — ${present.join(", ")}.`,
  );
}

/**
 * The provider, or `null` when the credential the whole path runs on is absent.
 *
 * The whole path — reads included — runs on the write-scoped token, so a dry run
 * needs it too, and the refusal says which of the two things is missing.
 */
function resolveProvider(
  options: AnatomiesOptions,
  env: Record<string, string | undefined>,
): CellWriter | null {
  if (options.provider !== undefined) {
    return options.provider;
  }
  if ((env[CodaProvider.WRITE_KEY_VAR] ?? "") === "") {
    return null;
  }
  return new CodaProvider(CodaProvider.WRITE_KEY_VAR);
}

/** What every credential refusal says, whether or not a write was asked for. */
function credentialRefusal(apply: boolean): AnatomiesResult {
  return refuse(
    [
      ...(apply ? ["✗ --apply refused.", ""] : []),
      `${CodaProvider.WRITE_KEY_VAR} is unset, so the document cannot be read.`,
      "",
      "The whole write path — its reads included — runs on the write-scoped token,",
      `which is what keeps ${CodaProvider.READ_KEY_VAR} read-only and`,
      "un-escalatable. Put the token in `.env` (gitignored) and re-run.",
    ].join("\n"),
  );
}

/** The two environment gates, which `write` and `restore` share. */
function environmentRefusals(
  env: Record<string, string | undefined>,
  verb: string,
): string[] {
  const refusals: string[] = [];
  if ((env.CI ?? "") !== "") {
    refusals.push(
      `CI is set. The ${verb} to the document is an act with a human reading the plan, never a pipeline step.`,
    );
  }
  if ((env[CodaProvider.WRITE_KEY_VAR] ?? "") === "") {
    refusals.push(
      `${CodaProvider.WRITE_KEY_VAR} is unset. The ${verb} path runs on the write-scoped token for its reads as well as its writes, and never on ${CodaProvider.READ_KEY_VAR}.`,
    );
  }
  return refusals;
}

/**
 * Where the anatomies live, or the configuration's own refusal as a result.
 *
 * The refusal is a sentence about `source.json` — the table it does not declare, or
 * the column nothing maps to the anatomy predicate — so it is printed rather than
 * thrown: a reader of a failed plan needs the remedy, not a stack trace.
 */
function resolveTable(
  path: string | undefined,
): AnatomyTable | AnatomiesResult {
  try {
    return readAnatomyTable(path);
  } catch (error) {
    if (error instanceof UnconfiguredAnatomiesError) {
      return refuse(error.message);
    }
    throw error;
  }
}

/** The apply: the snapshot, then the writes, then the reconcile. */
async function applyPlan(
  options: AnatomiesOptions,
  provider: CellWriter,
  table: AnatomyTable,
  live: LiveBlocks,
  plan: CellPlan,
): Promise<{ log: string[]; exitCode: number; written: Written }> {
  const stamp = options.stamp ?? snapshotStamp();
  const path = snapshotPath(stamp);
  const write = options.writeSnapshot ?? writeSnapshotFile;
  // The snapshot first, and of every live row: a write that cannot be put back is
  // not a write this repository makes.
  await write(path, JSON.stringify(snapshotOf(table, live, stamp), null, 2));

  const outcome = await applyCells({
    provider,
    table,
    updates: plan.updates,
    sleep: options.sleep,
  });

  const log = [
    `✓ snapshot written: ${path}`,
    `✓ ${outcome.writes} cell(s) written`,
  ];
  for (const mismatch of outcome.mismatches) {
    log.push(
      `✗ ${mismatch.uri} (row ${mismatch.rowId}) did not come back as it was written — the document holds ${mismatch.found.split("\n").length} line(s), the plan sent ${mismatch.expected.split("\n").length}`,
    );
  }
  log.push(
    outcome.mismatches.length === 0
      ? "✓ reconciled — every written cell reads back as its source."
      : `✗ ${outcome.mismatches.length} cell(s) did not reconcile. Re-run the dry run to see what the document holds.`,
  );

  return {
    log,
    exitCode: outcome.mismatches.length === 0 ? 0 : 1,
    written: {
      snapshot: path,
      writes: outcome.writes,
      mismatches: outcome.mismatches,
    },
  };
}

/** What an apply did, for the JSON to carry. */
interface Written {
  snapshot: string | null;
  writes: number;
  mismatches: Mismatch[];
}

const NOTHING_WRITTEN: Written = {
  snapshot: null,
  writes: 0,
  mismatches: [],
};

/** The JSON either verb prints: the whole plan, both texts in full. */
function asJson(
  plan: CellPlan,
  findings: readonly BindingFinding[],
  refusals: readonly string[],
  written: Written,
): string {
  return JSON.stringify(
    {
      verb: plan.verb,
      only: plan.only,
      tiers: plan.tiers,
      counts: {
        considered: plan.considered,
        unchanged: plan.unchanged.length,
        updates: plan.updates.length,
        missing: plan.missing.length,
      },
      updates: plan.updates,
      unchanged: plan.unchanged,
      missing: plan.missing,
      findings,
      refusals,
      ...written,
    },
    null,
    2,
  );
}

/**
 * `write`: the authored files into the document's `anatomy_dsl` cells.
 *
 * @note Impure — reads the authored files, the corpus and the document, and under
 *   `--apply` writes a snapshot and then the cells.
 */
export async function write(
  options: AnatomiesOptions,
): Promise<AnatomiesResult> {
  const env = options.env ?? process.env;
  const dir = options.authoredDir ?? AUTHORED_DIR;
  // Every authored file, whatever `--tier` says: the law below runs over the whole
  // corpus, and only the plan is narrowed.
  const authored: AuthoredAnatomy[] = readAuthored(dir);

  if (authored.length === 0) {
    return refuse(
      [
        `No authored anatomy in ${dir}.`,
        "",
        "`write` sends what is written and reviewed in that directory, one file per",
        "anatomy, to the `anatomy_dsl` cell of the block's row. Write the anatomy",
        "first, run `bun src/cli.ts anatomies validate`, and then plan the write.",
      ].join("\n"),
    );
  }

  const rejected = tierRefusal(
    options.tiers,
    [...new Set(authored.map((entry) => tierOf(entry.uri)))].sort(),
    dir,
  );
  if (rejected !== null) {
    return rejected;
  }

  const findings = checkAuthored(authored, {
    dataDir: options.dataDir,
    registerPath: options.registerPath,
  });
  const table = resolveTable(options.sourcePath);
  if ("exitCode" in table) {
    return table;
  }

  const provider = resolveProvider(options, env);
  if (provider === null) {
    return credentialRefusal(options.apply === true);
  }

  const live = await readLiveBlocks(provider, table);
  const plan = planCells(authored, live, options.only, options.tiers);
  if (options.only !== undefined && plan.considered === 0) {
    return refuse(
      `No authored anatomy named ${options.only} in ${dir}${
        options.tiers === undefined
          ? ""
          : ` under tier ${options.tiers.join(", ")}`
      }. --only names one file's anatomy, by its dotted local name.`,
    );
  }

  const refusals =
    options.apply === true ? environmentRefusals(env, "write") : [];
  if (options.apply === true) {
    if (hasFinding(findings)) {
      refusals.push(
        `the law reports ${findings.filter((finding) => finding.severity === "finding").length} finding(s). Register the exception or fix the value; a warning would not have stopped this.`,
      );
    }
    if (plan.missing.length > 0) {
      refusals.push(
        `${plan.missing.length} authored file(s) name no row in the live document — the file is stale or the uri is wrong.`,
      );
    }
    if (plan.updates.length === 0) {
      refusals.push(
        "the plan is empty: every cell already holds its file. Nothing to do is not an apply.",
      );
    }
  }

  // A finding or a stale file is non-zero on a dry run too: both are the corpus
  // being wrong, and a reader who only checks the exit code has to see that.
  let exitCode = hasFinding(findings) || plan.missing.length > 0 ? 1 : 0;
  let log: string[] = [];
  let written = NOTHING_WRITTEN;

  if (options.apply === true && refusals.length === 0) {
    // Every gate open means the law reported no finding and no file is stale, so the
    // exit code so far is 0 and the apply's own reconcile is what decides it.
    const outcome = await applyPlan(options, provider, table, live, plan);
    log = outcome.log;
    written = outcome.written;
    exitCode = outcome.exitCode;
  } else if (options.apply === true) {
    exitCode = 1;
  }

  return {
    exitCode,
    plan,
    output:
      options.json === true
        ? asJson(plan, findings, refusals, written)
        : renderCells({
            plan,
            findings,
            refusals,
            apply: options.apply === true,
            log,
          }),
  };
}

/**
 * `restore`: a snapshot of the `anatomy_dsl` cells, put back.
 *
 * The gates are the write's, minus the one that does not apply: there is nothing
 * authored here, so there is no law to run. It takes its OWN snapshot before it
 * writes, because a restore is a write too — restoring the wrong file has to be
 * undoable.
 *
 * @note Impure — reads the snapshot and the document, and under `--apply` writes a
 *   snapshot and then the cells.
 */
export async function restore(
  options: AnatomiesOptions,
): Promise<AnatomiesResult> {
  const env = options.env ?? process.env;
  const path = options.snapshot;
  if (path === undefined || path === "") {
    return refuse(
      "Usage: bun src/cli.ts anatomies restore <snapshot> [--apply] [--json]",
    );
  }

  const read = options.readFileText ?? readText;
  let snapshot: ReturnType<typeof parseSnapshot>;
  try {
    snapshot = parseSnapshot(JSON.parse(await read(path)));
  } catch (error) {
    return refuse(`${path}: ${(error as Error).message}`);
  }

  const table = resolveTable(options.sourcePath);
  if ("exitCode" in table) {
    return table;
  }
  // The snapshot names the document it came from, so it cannot be replayed into
  // another one. An older snapshot that names none is taken at its word.
  if (snapshot.document !== "" && snapshot.document !== table.document) {
    return refuse(
      `${path} was taken from document ${snapshot.document}, and ${table.path} names ${table.document}. A snapshot is only a snapshot of the document it came from.`,
    );
  }

  const provider = resolveProvider(options, env);
  if (provider === null) {
    return credentialRefusal(options.apply === true);
  }

  const live = await readLiveBlocks(provider, table);
  const plan = planRestore(snapshot, live, path);
  const refusals =
    options.apply === true ? environmentRefusals(env, "restore") : [];
  if (options.apply === true && plan.updates.length === 0) {
    refusals.push(
      "the plan is empty: every cell already says what the snapshot recorded. Nothing to do is not an apply.",
    );
  }

  let exitCode = 0;
  let log: string[] = [];
  let written = NOTHING_WRITTEN;

  if (options.apply === true && refusals.length === 0) {
    const outcome = await applyPlan(options, provider, table, live, plan);
    log = outcome.log;
    written = outcome.written;
    exitCode = outcome.exitCode;
  } else if (options.apply === true) {
    exitCode = 1;
  }

  return {
    exitCode,
    plan,
    output:
      options.json === true
        ? asJson(plan, [], refusals, written)
        : renderCells({
            plan,
            refusals,
            apply: options.apply === true,
            log,
          }),
  };
}

/** @note Impure — reads the file system. */
function readText(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

/**
 * Dispatch a subcommand.
 *
 * Returns the exit code and the text rather than calling `process.exit` and
 * `console.log`, so the whole surface is testable and `cli.ts` owns the process.
 */
export default async function anatomies(
  options: AnatomiesOptions,
): Promise<AnatomiesResult> {
  switch (options.subcommand) {
    case "validate":
      return validate(options);
    case "write":
      return write(options);
    case "restore":
      return restore(options);
    default:
      return {
        exitCode: 1,
        output: `Unknown subcommand ${JSON.stringify(options.subcommand)}. Expected one of: ${SUBCOMMANDS.join(", ")}`,
      };
  }
}

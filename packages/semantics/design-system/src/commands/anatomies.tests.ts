import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHORED_DIR } from "../anatomies/authored.js";
import { type Census, readCensus } from "../anatomies/census.js";
import type {
  ColumnMetadata,
  MutationStatus,
  RowUpdateResult,
  TableRow,
} from "../providers/index.js";
import type { CellWriter } from "../sync/applyCells.js";
import { SNAPSHOT_DIR } from "../sync/cellSnapshot.js";
import anatomies, {
  type AnatomiesOptions,
  restore,
  SUBCOMMANDS,
  validate,
  write,
} from "./anatomies.js";

let base: string;
let authored: string;
let data: string;

/** Button's anatomy, whose one symbol resolves: the write's lawful fixture. */
const BUTTON = [
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    typography.color: color.text",
  "",
].join("\n");

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "anatomies-write-test-"));
  authored = join(base, "authored");
  data = join(base, "data");
  await mkdir(join(authored, "global"), { recursive: true });
  await mkdir(data, { recursive: true });
  await writeFile(
    join(authored, "global", "global.component.button.yaml"),
    BUTTON,
    "utf-8",
  );
  // The graph the `uri:` check resolves against.
  await writeFile(
    join(data, "global.ttl"),
    '@prefix ds: <https://ds.canonical.com/>.\n\nds:global.component.button a ds:Component;\n    ds:name "Button".\n',
    "utf-8",
  );
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

/**
 * A `source.json` fixture, shaped like the committed one: the table id under
 * `extract.tables`, and the anatomy column and the subject template under
 * `transform.tables`. An empty `table` is a configuration that declares no table.
 */
async function configured(table = "grid-blocks"): Promise<string> {
  // Named after what it declares: two calls in one test must not overwrite each
  // other's file, or a fixture would silently be the wrong one.
  const path = join(
    base,
    `source-${table === "" ? "unconfigured" : table}.json`,
  );
  await writeFile(
    path,
    JSON.stringify({
      document: "doc",
      provider: "coda",
      extract: {
        output: "tmp/extract.json",
        // A declaration that names another table and not this one: the schema
        // requires at least one, and "no uiBlocks" is the fact under test.
        tables: table === "" ? { tiers: "grid-tiers" } : { uiBlocks: table },
      },
      transform: {
        format: "ttl",
        outputDir: "data/",
        atomicity: "instance",
        tables: {
          uiBlocks: {
            "@context": { name: "ds:name", anatomy_dsl: "ds:anatomyDsl" },
            class: "{type}",
            uriTemplate: "{uri}",
          },
        },
      },
    }),
    "utf-8",
  );
  return path;
}

/** A register file with the rows given (`[]` for none), and its path. */
async function register(rows: string): Promise<string> {
  const path = join(base, `register-${rows.length}.yaml`);
  await writeFile(path, `categories: {}\nrows:\n${rows}`, "utf-8");
  return path;
}

interface Recorded {
  rowId: string;
  cells: Record<string, string>;
}

/**
 * A fake document holding Button's row.
 *
 * STATEFUL — an update lands and a read sees it — because the reconcile is the half
 * worth testing: a fake that never changed would report a mismatch on every apply.
 * It keeps the rule the real API imposes: a write is addressed by column id.
 *
 * `extra` adds a row per `uri` named, which is how a test gives another tier's
 * anatomy somewhere to land: without one the file would be reported as naming no row
 * and the tier narrowing could not be told from a stale file.
 */
function fake(
  options: {
    cell?: string;
    swallow?: boolean;
    extra?: readonly string[];
    /** The document never reports the mutation applied. */
    neverCompletes?: boolean;
    /** The write comes back with no `requestId`, so there is nothing to follow. */
    noRequestId?: boolean;
    /** The status call itself fails — an expired request id answers 400. */
    statusFails?: boolean;
  } = {},
) {
  const rows: TableRow[] = [
    {
      _codaId: "i-button",
      uri: "global.component.button",
      anatomy_dsl: options.cell ?? "the old literal",
    },
    // A row with no anatomy and no `uri`: in the snapshot, out of the index.
    { _codaId: "i-blank", uri: "", anatomy_dsl: "" },
    ...(options.extra ?? []).map((uri) => ({
      _codaId: `i-${uri}`,
      uri,
      anatomy_dsl: "the old literal",
    })),
  ];
  const writes: Recorded[] = [];
  const provider: CellWriter & { writes: Recorded[] } = {
    writes,
    async fetchTable(): Promise<TableRow[]> {
      return rows;
    },
    async fetchTableColumns(): Promise<ColumnMetadata[]> {
      return ["uri", "anatomy_dsl", "name"].map((name) => ({
        id: `c-${name}`,
        name,
        type: "text",
        format: {} as ColumnMetadata["format"],
      }));
    },
    async updateRow(_document, _table, rowId, cells): Promise<RowUpdateResult> {
      writes.push({ rowId, cells });
      // A row PUT is answered with the queued mutation's id; the apply follows it
      // with `getMutationStatus` before it re-reads.
      const accepted = { id: rowId, requestId: `r-${writes.length}` };
      if (options.noRequestId === true) {
        return {} as RowUpdateResult;
      }
      if (options.swallow === true) {
        return accepted;
      }
      const row = rows.find((candidate) => candidate._codaId === rowId);
      for (const [column, value] of Object.entries(cells)) {
        (row as TableRow)[column.replace(/^c-/, "")] = value;
      }
      return accepted;
    },
    async getMutationStatus(): Promise<MutationStatus> {
      if (options.statusFails === true) {
        throw new Error("Coda API error: 400 Bad Request");
      }
      return { completed: options.neverCompletes !== true };
    },
  };
  return provider;
}

/** Run `write` over the fixtures, with the write token present by default. */
async function runWrite(
  options: Partial<AnatomiesOptions> = {},
  provider = fake(),
) {
  return write({
    subcommand: "write",
    authoredDir: authored,
    dataDir: data,
    sourcePath: await configured(),
    registerPath: await register("  []\n"),
    env: { CODA_WRITE_TOKEN: "write-token" },
    provider,
    sleep: async () => {},
    stamp: "stamped",
    writeSnapshot: async () => {},
    ...options,
  });
}

/** Run `restore` over a snapshot handed to it as text. */
async function runRestore(
  snapshotBody: unknown,
  options: Partial<AnatomiesOptions> = {},
  provider = fake(),
) {
  return restore({
    subcommand: "restore",
    snapshot: "anatomies/snapshots/earlier-uiBlocks.json",
    sourcePath: await configured(),
    env: { CODA_WRITE_TOKEN: "write-token" },
    provider,
    sleep: async () => {},
    stamp: "stamped",
    writeSnapshot: async () => {},
    readFileText: async () => JSON.stringify(snapshotBody),
    ...options,
  });
}

/** A snapshot body, as `write --apply` would have written one. */
function snapshotBody(cell: string) {
  return {
    document: "doc",
    table: "uiBlocks",
    takenAt: "earlier",
    rows: [
      { rowId: "i-button", uri: "global.component.button", anatomyDsl: cell },
      { rowId: "i-blank", uri: "", anatomyDsl: "" },
    ],
  };
}

describe("SUBCOMMANDS", () => {
  it("is the three verbs, and the roster is closed", () => {
    expect(SUBCOMMANDS).toEqual(["validate", "write", "restore"]);
  });
});

describe("validate", () => {
  it("runs the law over the committed corpus and refuses every unadmitted exception", () => {
    // No register is committed yet, so `readRegister` reads an empty one and the law's
    // exception clause admits nothing: the run is non-zero because an exception nobody
    // has recorded is a judgement nobody has made. `--write-register` derives the rows
    // before the check and exits 0 — which is what `ci.yml` and the pull sync run, and
    // what `validate.tests.ts` asserts against injected paths rather than the
    // committed files.
    //
    // The count comes from the committed census rather than from a literal here: the
    // corpus grows every time the document does, and a number in two places is a
    // number that goes stale in one of them.
    const census = readCensus() as Census;
    const result = validate({ subcommand: "validate" });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(`${census.anatomies} non-empty anatomies`);
  });

  it("prints the census and the findings with --json", () => {
    const census = readCensus() as Census;
    const result = validate({ subcommand: "validate", json: true });
    const parsed = JSON.parse(result.output);

    expect(parsed.census.anatomies).toBe(census.anatomies);
    expect(parsed.exitCode).toBe(1);
    expect(Array.isArray(parsed.findings)).toBe(true);

    // What makes the non-zero exit a registration gap rather than a defect: every
    // refusal is an exception the register carries a category for, and the committed
    // census counts a row under each of those categories. A finding whose code the
    // census does not count would be something else entirely.
    const refused = new Set<string>(
      (parsed.findings as Array<{ code: string; severity: string }>)
        .filter((finding) => finding.severity === "finding")
        .map((finding) => finding.code),
    );
    expect(refused.size).toBeGreaterThan(0);
    for (const code of refused) {
      expect(census.categories[code]).toBeGreaterThan(0);
    }
  });
});

describe("validate --authored", () => {
  const runAuthored = async (options: Partial<AnatomiesOptions> = {}) =>
    validate({
      subcommand: "validate",
      authored: true,
      authoredDir: authored,
      dataDir: data,
      registerPath: await register("  []\n"),
      ...options,
    });

  /**
   * Button with one state difference, and two anatomies that reference it — the
   * shape the corpus is full of, in three files.
   */
  const stateDifferenceFixture = async () => {
    await writeFile(
      join(authored, "global", "global.component.button.yaml"),
      [
        "node:",
        "  uri: global.component.button",
        "  styles:",
        "    appearance.background: [modifier.color.foreground.ghost, color.foreground.ghost]",
        "    appearance.background@hover: [modifier.color.foreground.ghost, color.foreground.ghost.hover]",
        "",
      ].join("\n"),
      "utf-8",
    );
    for (const referrer of ["card", "tile"]) {
      await writeFile(
        join(authored, "global", `global.component.${referrer}.yaml`),
        [
          "node:",
          `  uri: global.component.${referrer}`,
          "  edges:",
          "    - node:",
          "        uri: global.component.button",
          '      relation: { cardinality: "1" }',
          "",
        ].join("\n"),
        "utf-8",
      );
    }
  };

  it("runs the law over the authored files offline and passes a lawful file", async () => {
    const result = await runAuthored();

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("1 anatomy/anatomies");
    expect(result.output).toContain("every file is lawful");
  });

  it("reports a finding by name and exits non-zero, without any document", async () => {
    await writeFile(
      join(authored, "global", "global.component.button.yaml"),
      "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
      "utf-8",
    );
    const result = await runAuthored();

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("findings:");
    expect(result.output).toContain("modifier.color.nothing");
  });

  it("prints a warning under its own heading and keeps the exit code at 0", async () => {
    // A `@hover` binding that differs from its base state at some rank is a
    // warning, as the write treats it: printed, exit code unchanged.
    await writeFile(
      join(authored, "global", "global.component.button.yaml"),
      [
        "node:",
        "  uri: global.component.button",
        "  styles:",
        "    typography.color: [modifier.color.text, color.text]",
        "    appearance.background: [modifier.color.foreground.ghost, color.foreground.ghost]",
        "    appearance.background@hover: [modifier.color.foreground.ghost, color.foreground.ghost.hover]",
        "",
      ].join("\n"),
      "utf-8",
    );
    const result = await runAuthored();

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("warnings:");
    expect(result.output).toContain("1 warning(s), 0 findings");
  });

  it("says one origin's state differences once, not once per reference", async () => {
    // Button's `@hover` differs from its base state, and two anatomies reference
    // Button — so the lint fires three times, at Button and at each referrer's own
    // node path, and the reader is told the one thing once.
    await stateDifferenceFixture();
    const result = await runAuthored();
    const warnings = result.output
      .split("\n")
      .filter((line) => line.includes("AT11"));

    expect(warnings).toEqual([
      "  ⚠ AT11 global.component.button: 1 state binding differs from its base state (appearance.background@hover), surfacing in 3 anatomies through references",
    ]);
    expect(result.output).toContain("1 warning(s), 0 findings");
    expect(result.exitCode).toBe(0);
  });

  it("keeps every warning ungrouped with --json, which is the machine form", async () => {
    await stateDifferenceFixture();
    const parsed = JSON.parse((await runAuthored({ json: true })).output) as {
      findings: Array<{ code: string; block: string }>;
    };

    // One per place, as the lint fires: grouping is a rendering choice and the
    // machine form carries what the lint found.
    expect(parsed.findings.map((finding) => finding.block).sort()).toEqual([
      "https://ds.canonical.com/global.component.button",
      "https://ds.canonical.com/global.component.card",
      "https://ds.canonical.com/global.component.tile",
    ]);
  });

  it("carries the files and the findings with --json", async () => {
    const result = await runAuthored({ json: true });
    const parsed = JSON.parse(result.output) as {
      exitCode: number;
      authored: string[];
      findings: unknown[];
    };

    expect(parsed.exitCode).toBe(0);
    expect(parsed.authored).toEqual(["global.component.button"]);
    expect(parsed.findings).toEqual([]);
  });

  it("reads the committed authored directory when none is given", async () => {
    // Asserts the default was USED, not that it is empty: a checkout with authored
    // files in it is a legitimate state, and the test must hold in both.
    const result = validate({
      subcommand: "validate",
      authored: true,
      dataDir: data,
      registerPath: await register("  []\n"),
    });

    const usedTheDefault =
      result.output.includes(`No authored anatomy in ${AUTHORED_DIR}`) ||
      result.output.includes(`in ${AUTHORED_DIR}`);
    expect(usedTheDefault).toBe(true);
  });

  it("says what to write first when the authored directory is empty", async () => {
    const result = await runAuthored({ authoredDir: join(base, "empty") });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("No authored anatomy in");
  });

  it("reads only the tier named, and says so in the header line", async () => {
    // The narrowing here is of the READ, which is the opposite of what `--tier` does
    // to the write: an author has one tier open and wants that tier's answer. The
    // other tier's file is unlawful and the run is clean, which is how a test can
    // tell a narrowed read from a narrowed report.
    await mkdir(join(authored, "apps"), { recursive: true });
    await writeFile(
      join(authored, "apps", "apps.pattern.side_panel.yaml"),
      "node:\n  uri: apps.pattern.side_panel\n  styles:\n    typography.color: modifier.color.nothing\n",
      "utf-8",
    );

    const result = await runAuthored({ tiers: ["global"] });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(
      `Authored: 1 anatomy/anatomies in ${authored} (tiers: global)`,
    );
    expect(result.output).not.toContain("modifier.color.nothing");
  });

  it("refuses a tier no authored file is in, rather than validating nothing", async () => {
    const result = await runAuthored({ tiers: ["sites"] });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("No authored anatomy in tier sites");
    expect(result.output).toContain(authored);
  });

  it("refuses a --tier with no tier name after it", async () => {
    const result = await runAuthored({ tiers: [] });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("--tier needs a tier name");
  });

  it("carries the tiers in --json, beside the anatomies it read", async () => {
    const result = await runAuthored({ json: true, tiers: ["global"] });
    const parsed = JSON.parse(result.output) as {
      tiers: string[] | null;
      authored: string[];
    };

    expect(parsed.tiers).toEqual(["global"]);
    expect(parsed.authored).toEqual(["global.component.button"]);
  });

  it("says the tiers are all of them with a null in --json", async () => {
    const result = await runAuthored({ json: true });

    expect(
      (JSON.parse(result.output) as { tiers: string[] | null }).tiers,
    ).toBeNull();
  });
});

describe("the write's dry run", () => {
  it("plans the cell and writes nothing", async () => {
    const provider = fake();
    const result = await runWrite({}, provider);

    expect(result.exitCode).toBe(0);
    expect(provider.writes).toEqual([]);
    expect(result.plan?.updates).toHaveLength(1);
    expect(result.plan?.updates[0].after).toBe(BUTTON);
    expect(result.output).toContain(
      "✓ dry run: nothing written. Re-run with --apply to write.",
    );
  });

  it("plans nothing for a cell that already holds its file", async () => {
    const result = await runWrite({}, fake({ cell: BUTTON }));

    expect(result.plan?.unchanged).toEqual(["global.component.button"]);
    expect(result.plan?.updates).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it("carries the whole plan, both texts in full, with --json", async () => {
    const result = await runWrite({ json: true });
    const parsed = JSON.parse(result.output);

    expect(parsed.verb).toBe("write");
    expect(parsed.only).toBeNull();
    expect(parsed.counts).toEqual({
      considered: 1,
      unchanged: 0,
      updates: 1,
      missing: 0,
    });
    expect(parsed.updates[0].before).toBe("the old literal");
    expect(parsed.updates[0].after).toBe(BUTTON);
    expect(parsed.refusals).toEqual([]);
    expect(parsed.snapshot).toBeNull();
    expect(parsed.writes).toBe(0);
  });

  it("restricts the plan to one anatomy under --only, which is the canary", async () => {
    await writeFile(
      join(authored, "global", "global.component.card.yaml"),
      "node:\n  uri: global.component.card\n",
      "utf-8",
    );
    const result = await runWrite({ only: "global.component.button" });

    expect(result.plan?.considered).toBe(1);
    expect(result.output).toContain(
      "Anatomy cells — global.component.button, one anatomy",
    );
  });

  it("refuses an --only that names no authored file, naming the directory", async () => {
    const result = await runWrite({ only: "global.component.nothing" });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "No authored anatomy named global.component.nothing",
    );
    expect(result.plan).toBeNull();
  });

  it("names every tier in the header when the run covers all of them", async () => {
    // No `--tier` is every tier, and the header says nothing about tiers rather than
    // listing the whole roster: the narrowed header is the one worth reading.
    const result = await runWrite();

    expect(result.output).toContain(
      "Anatomy cells — the authored anatomies against uiBlocks.anatomy_dsl",
    );
    expect(result.output).not.toContain("(tiers:");
  });

  it("says what to write first when the authored directory is empty", async () => {
    const result = await runWrite({ authoredDir: join(base, "empty") });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      `No authored anatomy in ${join(base, "empty")}`,
    );
    expect(result.output).toContain("anatomies validate");
    expect(result.plan).toBeNull();
  });

  it("reads the committed authored directory when none is given", async () => {
    // The default is the directory the anatomies are written in. The assertion is
    // that the default was USED — not that it happens to be empty: a checkout with
    // authored files in it is a legitimate state, and the test must hold in both.
    const result = await write({
      subcommand: "write",
      dataDir: data,
      sourcePath: await configured(),
      registerPath: await register("  []\n"),
      env: { CODA_WRITE_TOKEN: "write-token" },
      provider: fake(),
    });

    const usedTheDefault =
      result.output.includes(`No authored anatomy in ${AUTHORED_DIR}`) ||
      result.plan !== null;
    expect(usedTheDefault).toBe(true);
  });

  it("reports an authored file that names no live row, and exits non-zero", async () => {
    // A stale file or a wrong `uri:`. Non-zero on the dry run too: it is the
    // repository being wrong, and a reader who only checks the exit code must see it.
    await writeFile(
      join(authored, "global", "global.component.ghost.yaml"),
      "node:\n  uri: global.component.ghost\n",
      "utf-8",
    );
    const result = await runWrite();

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "row not found in live document — the file is stale or the uri is wrong",
    );
    expect(result.output).toContain("global.component.ghost");
  });

  it("refuses by name when the table is not configured", async () => {
    const result = await runWrite({ sourcePath: await configured("") });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "declares no `uiBlocks` table under `extract.tables`",
    );
    expect(result.plan).toBeNull();
  });

  it("lets a configuration that does not validate through as itself", async () => {
    // A defect in the checkout, not a fact about the document: the schema's own
    // message says which field is wrong, and wrapping it in a refusal would lose that.
    const path = join(base, "broken-source.json");
    await writeFile(path, JSON.stringify({ provider: "coda" }), "utf-8");

    await expect(runWrite({ sourcePath: path })).rejects.toThrow(
      "Invalid config",
    );
  });

  it("names the credential on a dry run too, without claiming a write was refused", async () => {
    // The whole path reads on the write-scoped token, so a dry run needs it as
    // well — and must not claim to have refused a write nobody asked for.
    const result = await runWrite({ env: {}, provider: undefined });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("CODA_WRITE_TOKEN is unset");
    expect(result.output).not.toContain("--apply refused");
  });
});

describe("the write's --tier", () => {
  /** One anatomy in its tier's own directory, as the corpus is laid out. */
  const inTier = async (uri: string, styles = ""): Promise<void> => {
    const tier = uri.split(".")[0] as string;
    await mkdir(join(authored, tier), { recursive: true });
    await writeFile(
      join(authored, tier, `${uri}.yaml`),
      `node:\n  uri: ${uri}\n${styles}`,
      "utf-8",
    );
  };

  /** A binding no register row admits, which is a finding wherever it is read. */
  const UNLAWFUL = "  styles:\n    typography.color: modifier.color.nothing\n";

  it("plans only the tiers named, and says which they are", async () => {
    await inTier("apps.pattern.side_panel");
    const result = await runWrite(
      { tiers: ["global"] },
      fake({ extra: ["apps.pattern.side_panel"] }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.plan?.considered).toBe(1);
    expect(result.plan?.updates.map((cell) => cell.uri)).toEqual([
      "global.component.button",
    ]);
    expect(result.plan?.missing).toEqual([]);
    expect(result.output).toContain(
      "Anatomy cells — the authored anatomies against uiBlocks.anatomy_dsl (tiers: global)",
    );
  });

  it("names several tiers in the order they were given", async () => {
    await inTier("apps.pattern.side_panel");
    const result = await runWrite(
      { tiers: ["global", "apps"] },
      fake({ extra: ["apps.pattern.side_panel"] }),
    );

    expect(result.plan?.considered).toBe(2);
    expect(result.output).toContain("(tiers: global, apps)");
  });

  it("leaves the tiers it does not cover authored and unsent under --apply", async () => {
    // The point of the flag: the second-level tiers stay in the repository, lawful
    // and reviewed, and no cell of theirs is touched this round.
    await inTier("apps_lxd.component.instances");
    const provider = fake({ extra: ["apps_lxd.component.instances"] });
    const result = await runWrite({ apply: true, tiers: ["global"] }, provider);

    expect(result.exitCode).toBe(0);
    expect(provider.writes.map((entry) => entry.rowId)).toEqual(["i-button"]);
  });

  it("runs the law over every authored file, whatever tiers the plan covers", async () => {
    // A corpus is lawful or not as a whole. The unlawful file is in a tier this run
    // does not write, and it refuses the run all the same — writing a different
    // anatomy out of the corpus does not make an unregistered symbol lawful.
    await inTier("apps.pattern.side_panel", UNLAWFUL);
    const provider = fake({ extra: ["apps.pattern.side_panel"] });
    const result = await runWrite({ apply: true, tiers: ["global"] }, provider);

    expect(result.exitCode).toBe(1);
    expect(result.plan?.considered).toBe(1);
    expect(result.output).toContain("modifier.color.nothing");
    expect(result.output).toContain("the law reports");
    expect(provider.writes).toEqual([]);
  });

  it("composes with --only, which picks one anatomy out of the tiers in force", async () => {
    await inTier("global.component.card");
    await inTier("apps.pattern.side_panel");
    const result = await runWrite(
      { only: "global.component.button", tiers: ["global"] },
      fake({ extra: ["apps.pattern.side_panel"] }),
    );

    expect(result.plan?.considered).toBe(1);
    expect(result.output).toContain(
      "Anatomy cells — global.component.button, one anatomy (tiers: global)",
    );
  });

  it("refuses an --only that names a file outside the tiers in force", async () => {
    await inTier("apps.pattern.side_panel");
    const result = await runWrite(
      { only: "apps.pattern.side_panel", tiers: ["global"] },
      fake({ extra: ["apps.pattern.side_panel"] }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "No authored anatomy named apps.pattern.side_panel",
    );
    expect(result.output).toContain("under tier global");
    expect(result.plan).toBeNull();
  });

  it("refuses a tier no authored file is in, naming the directory and the tiers it has", async () => {
    // Not a narrowing to nothing: a misspelt tier that planned zero cells reads
    // exactly like a corpus already in step.
    await inTier("apps.pattern.side_panel");
    const result = await runWrite({ tiers: ["sites"] });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("No authored anatomy in tier sites");
    expect(result.output).toContain(authored);
    expect(result.output).toContain("apps, global");
    expect(result.plan).toBeNull();
  });

  it("names only the tiers that are absent, not the ones that are there", async () => {
    const result = await runWrite({ tiers: ["global", "sites"] });

    expect(result.output).toContain("No authored anatomy in tier sites.");
  });

  it("refuses a --tier with no tier name after it", async () => {
    // `anatomies write --tier --apply` must not be read as "every tier" and write
    // the lot: the parser hands an empty list through and the refusal says so.
    const result = await runWrite({ tiers: [] });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("--tier needs a tier name");
    expect(result.plan).toBeNull();
  });

  it("carries the tiers in --json, beside the counts they are of", async () => {
    await inTier("apps.pattern.side_panel");
    const result = await runWrite(
      { json: true, tiers: ["global"] },
      fake({ extra: ["apps.pattern.side_panel"] }),
    );
    const parsed = JSON.parse(result.output);

    expect(parsed.tiers).toEqual(["global"]);
    expect(parsed.counts.considered).toBe(1);
  });
});

describe("the write's gates", () => {
  it("refuses --apply under CI, because the write is an act with a human in it", async () => {
    const provider = fake();
    const result = await runWrite(
      { apply: true, env: { CODA_WRITE_TOKEN: "t", CI: "1" } },
      provider,
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("✗ --apply refused:");
    expect(result.output).toContain("CI is set.");
    expect(provider.writes).toEqual([]);
  });

  it("refuses --apply without the write token, and never reaches for the read key", async () => {
    const result = await write({
      subcommand: "write",
      authoredDir: authored,
      dataDir: data,
      sourcePath: await configured(),
      registerPath: await register("  []\n"),
      apply: true,
      env: { CODA_API_KEY: "read-only-key" },
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("✗ --apply refused.");
    expect(result.output).toContain("CODA_WRITE_TOKEN is unset");
    expect(result.output).toContain("keeps CODA_API_KEY read-only");
  });

  it("refuses --apply on a finding, with the token set and CI unset", async () => {
    // The gate that is the validation and not the environment: no register row
    // admits the symbol, so the law reports it and the write is refused.
    await writeFile(
      join(authored, "global", "global.component.button.yaml"),
      "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
      "utf-8",
    );
    const provider = fake();
    const result = await runWrite({ apply: true }, provider);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("the law reports");
    expect(result.output).toContain("modifier.color.nothing");
    expect(provider.writes).toEqual([]);
  });

  it("proceeds on a warning, which is printed and changes no exit code", async () => {
    // A `@hover` binding that differs from its base state at some rank is a warning:
    // the exit-code table prints it and the run proceeds.
    await writeFile(
      join(authored, "global", "global.component.button.yaml"),
      [
        "node:",
        "  uri: global.component.button",
        "  styles:",
        "    typography.color: [modifier.color.text, color.text]",
        "    appearance.background: [modifier.color.foreground.ghost, color.foreground.ghost]",
        "    appearance.background@hover: [modifier.color.foreground.ghost, color.foreground.ghost.hover]",
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = await runWrite();

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(
      "warnings — printed, and the run proceeds:",
    );
  });

  it("refuses --apply on a stale file, which is a finding about the corpus", async () => {
    await writeFile(
      join(authored, "global", "global.component.ghost.yaml"),
      "node:\n  uri: global.component.ghost\n",
      "utf-8",
    );
    const provider = fake();
    const result = await runWrite({ apply: true }, provider);

    expect(result.output).toContain("authored file(s) name no row");
    expect(provider.writes).toEqual([]);
  });

  it("refuses --apply when there is nothing to write", async () => {
    // Nothing to do is not an apply: a run that wrote nothing and said it succeeded
    // would be indistinguishable from one that silently failed to plan.
    const provider = fake({ cell: BUTTON });
    const result = await runWrite({ apply: true }, provider);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("the plan is empty");
    expect(provider.writes).toEqual([]);
  });
});

describe("the write's apply", () => {
  it("snapshots first, writes the cell, and reconciles", async () => {
    const provider = fake();
    const snapshots: Array<{ path: string; body: string }> = [];

    const result = await runWrite(
      {
        apply: true,
        writeSnapshot: async (path, body) => {
          snapshots.push({ path, body });
        },
      },
      provider,
    );

    // The snapshot comes before the first write, and carries every live row — the
    // blank one included, because a snapshot of some of the table cannot put it back.
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].path).toBe(`${SNAPSHOT_DIR}/stamped-uiBlocks.json`);
    const written = JSON.parse(snapshots[0].body);
    expect(written.document).toBe("doc");
    expect(written.rows).toHaveLength(2);
    expect(written.rows[0]).toEqual({
      rowId: "i-button",
      uri: "global.component.button",
      anatomyDsl: "the old literal",
    });

    expect(provider.writes).toEqual([
      { rowId: "i-button", cells: { "c-anatomy_dsl": BUTTON } },
    ]);
    expect(result.output).toContain("✓ snapshot written");
    expect(result.output).toContain("✓ 1 cell(s) written");
    expect(result.output).toContain(
      "✓ reconciled — every written cell reads back as its source.",
    );
    expect(result.exitCode).toBe(0);
  });

  it("reports a cell the document accepted and never changed, and exits non-zero", async () => {
    const result = await runWrite({ apply: true }, fake({ swallow: true }));

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("did not come back as it was written");
    // The mutation status is the half that says WHOSE fault it is: the document
    // applied the write and the cell is still what it was, so the document itself is
    // refusing the content and re-running will not land it.
    expect(result.output).toContain(
      "the mutation completed but the cell did not change (request r-1)",
    );
    expect(result.output).toContain("did not reconcile");
  });

  it("says so when the document never completed the mutation inside the bound", async () => {
    const result = await runWrite(
      { apply: true },
      fake({ swallow: true, neverCompletes: true }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "the mutation never completed within 60 s (request r-1)",
    );
  });

  it("says so when the status call itself failed, rather than losing the reconcile", async () => {
    const result = await runWrite(
      { apply: true },
      fake({ swallow: true, statusFails: true }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "the mutation could not be followed: Coda API error: 400 Bad Request (request r-1)",
    );
  });

  it("says so when the write came back with no request id to follow", async () => {
    const result = await runWrite(
      { apply: true },
      fake({ swallow: true, noRequestId: true }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "the write came back with no request id, so its mutation could not be followed",
    );
  });

  it("carries what it wrote in the --json, including the snapshot's path and every request id", async () => {
    const result = await runWrite({ apply: true, json: true });
    const parsed = JSON.parse(result.output);

    expect(parsed.snapshot).toBe(`${SNAPSHOT_DIR}/stamped-uiBlocks.json`);
    expect(parsed.writes).toBe(1);
    expect(parsed.mismatches).toEqual([]);
    // One record per write, so a run can be correlated against the document's own
    // record of the mutation afterwards.
    expect(parsed.mutations).toEqual([
      {
        uri: "global.component.button",
        rowId: "i-button",
        requestId: "r-1",
        completed: true,
        waitedMs: 0,
        error: null,
      },
    ]);
  });

  it("stamps the snapshot with the clock when no stamp is given", async () => {
    const names: string[] = [];
    await runWrite({
      apply: true,
      stamp: undefined,
      writeSnapshot: async (path) => {
        names.push(path);
      },
    });

    // An ISO timestamp with the colons and dots replaced: two runs in one day cannot
    // collide, and the names sort into the order they were taken.
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(
      /^anatomies\/snapshots\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-uiBlocks\.json$/,
    );
  });
});

describe("the write's real seams", () => {
  it("builds its own provider from the token, and lets an API failure through", async () => {
    // No provider injected: the verb constructs one on `CODA_WRITE_TOKEN`. The API
    // answers 404, which is not something a retry fixes, so it propagates rather
    // than being reported as a plan. The credential is read from the environment,
    // because that is where the real provider reads it.
    vi.stubEnv("CODA_WRITE_TOKEN", "write-token");
    const realFetch = global.fetch;
    global.fetch = (async () =>
      ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        json: async () => ({}),
        text: async () => "no such table",
      }) as unknown as Response) as typeof fetch;

    try {
      await expect(
        write({
          subcommand: "write",
          authoredDir: authored,
          dataDir: data,
          sourcePath: await configured(),
          registerPath: await register("  []\n"),
        }),
      ).rejects.toThrow("Coda API error: 404");
    } finally {
      global.fetch = realFetch;
    }
  });

  it("writes its snapshot to a real file when nothing is injected", async () => {
    const provider = fake();
    const path = join(
      process.cwd(),
      SNAPSHOT_DIR,
      "write-real-seam-test-uiBlocks.json",
    );

    try {
      const result = await runWrite(
        {
          apply: true,
          stamp: "write-real-seam-test",
          writeSnapshot: undefined,
        },
        provider,
      );

      expect(result.output).toContain("write-real-seam-test-uiBlocks.json");
      const written = JSON.parse(await readFile(path, "utf-8"));
      expect(written.document).toBe("doc");
    } finally {
      await rm(path, { force: true });
    }
  });
});

describe("restore", () => {
  it("plans the cells that differ from the snapshot, and writes nothing", async () => {
    const result = await runRestore(snapshotBody("what it said before"));

    expect(result.exitCode).toBe(0);
    expect(result.plan?.verb).toBe("restore");
    expect(result.plan?.updates).toEqual([
      {
        uri: "global.component.button",
        rowId: "i-button",
        before: "the old literal",
        after: "what it said before",
        source: "anatomies/snapshots/earlier-uiBlocks.json",
      },
    ]);
    expect(result.output).toContain("Re-run with --apply to restore.");
  });

  it("takes its own snapshot before it writes, because a restore is a write too", async () => {
    const provider = fake();
    const snapshots: string[] = [];
    const result = await runRestore(
      snapshotBody("what it said before"),
      {
        apply: true,
        writeSnapshot: async (path) => {
          snapshots.push(path);
        },
      },
      provider,
    );

    expect(snapshots).toEqual([`${SNAPSHOT_DIR}/stamped-uiBlocks.json`]);
    expect(provider.writes).toEqual([
      { rowId: "i-button", cells: { "c-anatomy_dsl": "what it said before" } },
    ]);
    expect(result.exitCode).toBe(0);
  });

  it("prints a usage line when no snapshot is named", async () => {
    // Both spellings of absent: no argument at all, and a flag read as one.
    for (const snapshot of [undefined, ""]) {
      const result = await restore({ subcommand: "restore", snapshot });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("anatomies restore <snapshot>");
    }
  });

  it("refuses a file that is not a snapshot, naming the file", async () => {
    const result = await runRestore("not a snapshot at all");

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("earlier-uiBlocks.json: not a snapshot");
    expect(result.plan).toBeNull();
  });

  it("refuses a snapshot taken from another document", async () => {
    // A snapshot is only a snapshot of the document it came from. Replaying one into
    // another document would overwrite cells nobody ever read.
    const result = await runRestore({
      ...snapshotBody("x"),
      document: "SomeOtherDoc",
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("was taken from document SomeOtherDoc");
  });

  it("takes an older snapshot that names no document at its word", async () => {
    const body = snapshotBody("what it said before");
    const result = await runRestore({ ...body, document: undefined });

    expect(result.exitCode).toBe(0);
    expect(result.plan?.updates).toHaveLength(1);
  });

  it("refuses --apply under CI, without the token, and with nothing to put back", async () => {
    const underCI = await runRestore(snapshotBody("x"), {
      apply: true,
      env: { CODA_WRITE_TOKEN: "t", CI: "1" },
    });
    expect(underCI.output).toContain("CI is set.");
    expect(underCI.exitCode).toBe(1);

    const noToken = await runRestore(snapshotBody("x"), {
      apply: true,
      env: {},
    });
    expect(noToken.output).toContain("CODA_WRITE_TOKEN is unset");
    expect(noToken.exitCode).toBe(1);

    const nothingToDo = await runRestore(snapshotBody("the old literal"), {
      apply: true,
    });
    expect(nothingToDo.output).toContain("the plan is empty");
    expect(nothingToDo.exitCode).toBe(1);
  });

  it("names the credential when the document cannot even be read", async () => {
    const result = await runRestore(
      snapshotBody("x"),
      { env: {}, provider: undefined },
      fake(),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("CODA_WRITE_TOKEN is unset");
  });

  it("refuses by name when the table is not configured", async () => {
    const result = await runRestore(snapshotBody("x"), {
      sourcePath: await configured(""),
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(
      "declares no `uiBlocks` table under `extract.tables`",
    );
  });

  it("reports a row deleted since the snapshot, and still restores the rest", async () => {
    // A restore does not create rows — the roster is the pull sync's — so the deleted
    // row is reported and the cells that are still there go back.
    const body = snapshotBody("what it said before");
    body.rows.push({
      rowId: "i-gone",
      uri: "global.component.gone",
      anatomyDsl: "orphaned",
    });
    const result = await runRestore(body);

    expect(result.output).toContain("deleted since the snapshot was taken");
    expect(result.plan?.updates).toHaveLength(1);
    // Not a refusal: the snapshot is still worth putting back, and the missing row is
    // the pull sync's business rather than this verb's.
    expect(result.exitCode).toBe(0);
  });

  it("reports a cell the document would not take, and exits non-zero", async () => {
    const result = await runRestore(
      snapshotBody("what it said before"),
      { apply: true },
      fake({ swallow: true }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("did not reconcile");
  });

  it("carries the plan with --json", async () => {
    const result = await runRestore(snapshotBody("what it said before"), {
      json: true,
    });
    const parsed = JSON.parse(result.output);

    expect(parsed.verb).toBe("restore");
    expect(parsed.findings).toEqual([]);
    expect(parsed.counts.updates).toBe(1);
  });

  it("reads the snapshot off the disk when no reader is injected", async () => {
    const path = join(base, "earlier-uiBlocks.json");
    await writeFile(
      path,
      JSON.stringify(snapshotBody("what it said before")),
      "utf-8",
    );

    const result = await runRestore(null, {
      snapshot: path,
      readFileText: undefined,
    });

    expect(result.exitCode).toBe(0);
    expect(result.plan?.updates).toHaveLength(1);
  });
});

describe("anatomies", () => {
  it("dispatches validate", async () => {
    // 1, not 0: the register is not committed, so the law admits nothing. The point
    // here is the dispatch, and `validate` above says why the code is what it is.
    expect((await anatomies({ subcommand: "validate" })).exitCode).toBe(1);
  });

  it("dispatches write", async () => {
    const result = await anatomies({
      subcommand: "write",
      authoredDir: join(base, "empty"),
    });
    expect(result.output).toContain("No authored anatomy in");
  });

  it("dispatches restore", async () => {
    const result = await anatomies({ subcommand: "restore" });
    expect(result.output).toContain("anatomies restore <snapshot>");
  });

  it("names an unknown subcommand against the closed roster", async () => {
    const result = await anatomies({ subcommand: "derive" });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unknown subcommand "derive"');
    expect(result.output).toContain(
      "Expected one of: validate, write, restore",
    );
  });
});

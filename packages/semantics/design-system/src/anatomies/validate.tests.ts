import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSymbolIndex } from "../transform/symbols.js";
import validateAnatomies, {
  CATEGORIES,
  classifyParseFailure,
  classifyUnresolved,
  danglingReference,
  EMPTY_REASONS,
  RETIRED_PATH,
  renderValidateResult,
} from "./validate.js";

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "validate-test-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

/** A fixture corpus: one Turtle file, one block, one anatomy. */
async function corpus(
  entries: Record<string, string>,
  extra: string[] = [],
): Promise<void> {
  const blocks = Object.entries(entries).map(
    ([uri, dsl]) =>
      `ds:${uri} a ds:Component;\n    ds:name "X";\n    ds:anatomyDsl ${JSON.stringify(dsl)}.`,
  );
  await writeFile(
    join(base, "data.ttl"),
    `@prefix ds: <https://ds.canonical.com/>.\n\n${[...blocks, ...extra].join("\n\n")}\n`,
  );
}

function run(overrides: Record<string, unknown> = {}) {
  return validateAnatomies({
    dataDir: base,
    registerPath: join(base, "register.yaml"),
    censusPath: join(base, "census.json"),
    date: "2026-09-10",
    ...overrides,
  });
}

const codes = (findings: { code: string }[]) =>
  findings.map((finding) => finding.code);

describe("CATEGORIES and EMPTY_REASONS", () => {
  it("declares the ten categories a corpus can fill against the token graph, and none that needed a reference stylesheet", () => {
    expect(CATEGORIES).toHaveLength(10);
    for (const gone of ["X3", "X4", "X6", "X9", "X12", "X13"]) {
      expect(CATEGORIES).not.toContain(gone);
    }
  });

  it("gives a reason for every category this repository cannot fill", () => {
    for (const code of Object.keys(EMPTY_REASONS)) {
      expect(CATEGORIES).toContain(code);
      expect(EMPTY_REASONS[code].length).toBeGreaterThan(20);
    }
  });
});

describe("classifyUnresolved", () => {
  const symbols = loadSymbolIndex();
  const computed = new Set(["--hover--color-foreground-secondary"]);

  it("calls a computed state variable X15, checked against S4 and not the spelling", () => {
    expect(
      classifyUnresolved("hover.color.foreground.secondary", symbols, computed),
    ).toBe("X15");
    // Same first segment, no such variable: not X15, and `hover.` is a namespace
    // no declared symbol shares, so it lands in X1.
    expect(classifyUnresolved("hover.nothing.at.all", symbols, computed)).toBe(
      "X1",
    );
  });

  it("calls a channel whose base names nothing X7", () => {
    expect(classifyUnresolved("modifier.surface", symbols, computed)).toBe(
      "X7",
    );
  });

  it("calls a channel's state variant X5", () => {
    expect(
      classifyUnresolved("modifier.color.text.disabled", symbols, computed),
    ).toBe("X5");
    expect(
      classifyUnresolved("surface.color.background.hover", symbols, computed),
    ).toBe("X5");
  });

  it("calls a channel whose base resolves but is not itself a channel X5", () => {
    expect(classifyUnresolved("surface.color.text", symbols, computed)).toBe(
      "X5",
    );
  });

  it("calls a single-segment channel X7, with no state to strip", () => {
    expect(classifyUnresolved("modifier.nothing", symbols, computed)).toBe(
      "X7",
    );
  });

  it("calls an absent namespace X1 and a present one with no member X2", () => {
    expect(classifyUnresolved("motion.duration.fast", symbols, computed)).toBe(
      "X1",
    );
    expect(classifyUnresolved("spacing.small", symbols, computed)).toBe("X2");
  });
});

describe("RETIRED_PATH", () => {
  it("matches the retired slash paths and nothing dotted, so the skill and X16 agree", () => {
    expect(RETIRED_PATH.test("color/text/muted")).toBe(true);
    expect(RETIRED_PATH.test("shadow/card?")).toBe(true);
    expect(RETIRED_PATH.test("color.text.muted")).toBe(false);
    expect(RETIRED_PATH.test("1 / -1")).toBe(false);
  });
});

describe("classifyParseFailure", () => {
  it("maps each failure to a stable reason, not to the parser's prose", () => {
    expect(
      classifyParseFailure("… the slash-delimited token path is retired …"),
    ).toBe("retired-slash-path");
    expect(classifyParseFailure("… the trailing `?` marker is retired …")).toBe(
      "retired-marker",
    );
    expect(classifyParseFailure("… a primitive may only end a value: …")).toBe(
      "primitive-not-last",
    );
    expect(
      classifyParseFailure(
        "An anatomy document is a mapping with one `node` key",
      ),
    ).toBe("not-an-anatomy");
    expect(
      classifyParseFailure("Implicit keys need to be on a single line"),
    ).toBe("yaml-error");
  });
});

describe("danglingReference", () => {
  it("takes the uri: out of the finding", () => {
    expect(
      danglingReference(
        "a: uri: global.component.gone resolves to no ds: subject",
      ),
    ).toBe("global.component.gone");
  });
});

describe("validateAnatomies", () => {
  it("passes a corpus whose every element resolves", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: [modifier.color.text, color.text]\n",
    });
    const result = run();
    expect(result.findings.filter((f) => f.severity === "finding")).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.census.records).toBe(2);
    expect(result.census.parseable).toBe(1);
  });

  it("fails an unresolved element with no register row", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
    });
    expect(codes(run().findings)).toContain("UNRESOLVED");
    expect(run().exitCode).toBe(1);
  });

  it("registers it and passes under --write-register, which is why the diff is the gate", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
    });
    const result = run({ writeRegister: true });
    expect(result.exitCode).toBe(0);
    // A channel whose base names nothing is X7, whatever the base's shape.
    expect(result.register.rows.map((row) => row.category)).toContain("X7");
    expect(result.census.unresolved).toEqual(["modifier.color.nothing"]);
    // …and the row is on disk, with the count beside it.
    const written = await readFile(join(base, "register.yaml"), "utf-8");
    expect(written).toContain("modifier.color.nothing");
    expect(
      JSON.parse(await readFile(join(base, "census.json"), "utf-8")).records,
    ).toBe(1);
  });

  it("is a fixed point: a second --write-register run rewrites the same bytes", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    });
    run({ writeRegister: true });
    const first = await readFile(join(base, "register.yaml"), "utf-8");
    const firstCensus = await readFile(join(base, "census.json"), "utf-8");
    run({ writeRegister: true });
    expect(await readFile(join(base, "register.yaml"), "utf-8")).toBe(first);
    expect(await readFile(join(base, "census.json"), "utf-8")).toBe(
      firstCensus,
    );
  });

  it("keeps the date a row was first registered, so the gate is not red daily", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    });
    run({ writeRegister: true, date: "2026-09-01" });
    const result = run({ writeRegister: true, date: "2026-12-25" });
    expect(result.register.rows.every((row) => row.date === "2026-09-01")).toBe(
      true,
    );
  });

  it("preserves a hand-written rationale across a regeneration", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    });
    run({ writeRegister: true });
    const path = join(base, "register.yaml");
    const text = await readFile(path, "utf-8");
    await writeFile(
      path,
      text.replace(
        "    category: X7",
        "    category: X7\n    rationale: the importance shim",
      ),
    );
    const result = run({ writeRegister: true });
    expect(
      result.register.rows.find((row) => row.category === "X7")?.rationale,
    ).toBe("the importance shim");
  });

  it("gives an X7 element an X8 row too, because it is outside every namespace", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    });
    const result = run({ writeRegister: true });
    expect(new Set(result.register.rows.map((row) => row.category))).toEqual(
      new Set(["X7", "X8"]),
    );
  });

  it("admits an unparseable cell under X16 and refuses it without the row", async () => {
    await corpus({
      "global.component.legacy":
        "node:\n  uri: global.component.legacy\n  styles:\n    appearance.background: color/surface/button\n",
    });
    expect(codes(run().findings)).toContain("X16");
    const written = run({ writeRegister: true });
    expect(written.exitCode).toBe(0);
    expect(
      written.register.rows.find((row) => row.category === "X16")?.value,
    ).toBe("retired-slash-path");
  });

  it("admits a dangling uri: under X11 and refuses it without the row", async () => {
    await corpus({
      "global.component.host":
        'node:\n  uri: global.component.host\n  edges:\n    - node: { uri: global.component.gone }\n      relation: { cardinality: "1" }\n',
    });
    expect(codes(run().findings)).toContain("X11");
    const written = run({ writeRegister: true });
    expect(written.exitCode).toBe(0);
    expect(
      written.register.rows.find((row) => row.category === "X11")?.value,
    ).toBe("global.component.gone");
  });

  it("does not let one block's X16 row admit another block's failure", async () => {
    await corpus({
      "global.component.a":
        "node:\n  uri: global.component.a\n  styles:\n    appearance.background: color/surface/a\n",
      "global.component.b":
        "node:\n  uri: global.component.b\n  styles:\n    appearance.background: color/surface/b\n",
    });
    // A register that admits only a's failure: b's must still fail.
    await writeFile(
      join(base, "register.yaml"),
      [
        "categories:",
        "  X16: { count: 1 }",
        "rows:",
        "  - uri: global.component.a",
        "    node: null",
        "    key: null",
        "    state: null",
        "    value: retired-slash-path",
        "    category: X16",
        "    considered: []",
        "    date: 2026-09-10",
        "",
      ].join("\n"),
    );
    const findings = run().findings.filter((f) => f.code === "X16");
    expect(findings).toHaveLength(1);
    expect(findings[0].block).toContain("global.component.b");
  });

  it("warns, by name, on a Turtle file it cannot parse, and counts it in the census", async () => {
    // The transform wrote the file, so it is a defect here and not a finding: a
    // finding would stop the daily sync on a file it never touches. The warning
    // names the file and the count in the census is the diff that gets it fixed.
    await corpus({
      "global.component.button": "node:\n  uri: global.component.button\n",
    });
    await writeFile(join(base, "broken.ttl"), "@prefix ds: <oops");
    const result = run();
    const unparseable = result.findings.filter((f) => f.code === "TTL_PARSE");
    expect(unparseable).toHaveLength(1);
    expect(unparseable[0].severity).toBe("warning");
    expect(unparseable[0].message).toContain("broken.ttl");
    expect(result.exitCode).toBe(0);
    expect(result.census.unparseableFiles).toBe(1);
  });

  it("carries a count per category, with a reason where the count is 0", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    });
    const result = run({ writeRegister: true });
    expect(result.register.categories.X10).toEqual({
      count: 0,
      reason: EMPTY_REASONS.X10,
    });
    // A category with no reason of its own is empty because the corpus is clean.
    expect(result.register.categories.X1).toEqual({
      count: 0,
      reason: "no instance in the corpus",
    });
    expect(result.register.categories.X7).toEqual({ count: 1 });
  });

  it("scopes to one anatomy with --only, and refuses a name the corpus lacks", async () => {
    await corpus({
      "global.component.a": "node:\n  uri: global.component.a\n",
      "global.component.b": "node:\n  uri: global.component.b\n",
    });
    expect(run({ only: "global.component.a" }).census.anatomies).toBe(1);
    expect(() => run({ only: "global.component.z" })).toThrow(
      "no non-empty anatomy named global.component.z",
    );
  });

  it("fails a record count below the committed census, outside --write-register", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: color.text\n",
    });
    await writeFile(join(base, "census.json"), JSON.stringify({ records: 99 }));
    expect(codes(run().findings)).toContain("RECORD_FLOOR");
    // Under --write-register the census is regenerated first, so a count that moved is
    // a diff and not a finding.
    expect(codes(run({ writeRegister: true }).findings)).not.toContain(
      "RECORD_FLOOR",
    );
  });

  it("names the default data directory when --only misses there", () => {
    expect(() => validateAnatomies({ only: "global.component.nope" })).toThrow(
      "in data",
    );
  });

  it("keeps one row per identity when a block is reached twice", async () => {
    // `global.component.icon` fails to parse both on its own pass and when reached
    // from `spinner`, so the derivation reports it twice and the register must carry
    // one row: a duplicate would make the rationale preservation ambiguous.
    await corpus({
      "global.component.host":
        'node:\n  uri: global.component.host\n  edges:\n    - node: { uri: global.component.child }\n      relation: { cardinality: "1" }\n',
      "global.component.child":
        "node:\n  uri: global.component.child\n  styles:\n    appearance.background: color/surface/child\n",
    });
    const rows = run({ writeRegister: true }).register.rows.filter(
      (row) => row.category === "X16",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].uri).toBe("global.component.child");
  });

  it("defaults its date to today when none is injected", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    });
    const result = validateAnatomies({
      dataDir: base,
      registerPath: join(base, "register.yaml"),
      censusPath: join(base, "census.json"),
      writeRegister: true,
    });
    expect(result.register.rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("renderValidateResult", () => {
  it("prints the corpus, the register and a green line when nothing failed", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: color.text\n",
    });
    const text = renderValidateResult(run({ writeRegister: true }));
    expect(text).toContain("1 non-empty anatomies, 1 parse, 1 records");
    expect(text).toContain("rewrote anatomies/register.yaml");
    expect(text).toContain("✓ 0 warning(s), 0 findings");
  });

  it("marks findings and warnings differently and counts them", async () => {
    await corpus({
      "global.component.button":
        "node:\n  uri: global.component.button\n  styles:\n    typography.color: modifier.color.nothing\n",
    });
    await writeFile(join(base, "broken.ttl"), "@prefix ds: <oops");
    const text = renderValidateResult(run());
    expect(text).toContain("✗ [UNRESOLVED]");
    expect(text).toContain("⚠ [TTL_PARSE]");
    expect(text).toContain("✗ 1 finding(s), 1 warning(s)");
  });
});

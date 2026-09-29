import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Census, readCensus } from "./census.js";
import { byTier, DATA_DIR, listTurtle, readCorpus } from "./corpus.js";

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "corpus-test-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

/** One block's Turtle, with an anatomy literal on one line. */
function block(uri: string, anatomyDsl: string | null): string {
  const anatomy =
    anatomyDsl === null
      ? ""
      : `;\n    ds:anatomyDsl ${JSON.stringify(anatomyDsl)}`;
  return `@prefix ds: <https://ds.canonical.com/>.\n\nds:${uri} a ds:Component;\n    ds:name "X"${anatomy}.\n`;
}

describe("DATA_DIR", () => {
  it("is the directory the Coda sync owns and the corpus is read from", () => {
    expect(DATA_DIR).toBe("data");
  });
});

describe("listTurtle", () => {
  it("finds Turtle recursively, sorted, and ignores everything else", async () => {
    await mkdir(join(base, "global", "component"), { recursive: true });
    await writeFile(join(base, "global", "component", "b.ttl"), "");
    await writeFile(join(base, "global", "component", "a.ttl"), "");
    await writeFile(join(base, "global", "component", "notes.md"), "");
    await writeFile(join(base, "global.ttl"), "");
    // Directory before file at each level, and alphabetical within it: the order is
    // deterministic, which is what a reproducible census needs.
    expect(listTurtle(base).map((path) => path.slice(base.length))).toEqual([
      "/global/component/a.ttl",
      "/global/component/b.ttl",
      "/global.ttl",
    ]);
  });
});

describe("readCorpus", () => {
  it("collects every non-empty anatomy, keyed and sorted by dotted name", async () => {
    await writeFile(
      join(base, "one.ttl"),
      block(
        "global.component.button",
        "node:\n  uri: global.component.button\n",
      ),
    );
    await writeFile(
      join(base, "two.ttl"),
      block(
        "apps_lxd.component.meter",
        "node:\n  uri: apps_lxd.component.meter\n",
      ),
    );
    const corpus = readCorpus(base);
    expect(corpus.files).toBe(2);
    expect(corpus.entries.map((entry) => entry.uri)).toEqual([
      "apps_lxd.component.meter",
      "global.component.button",
    ]);
    expect(corpus.entries[0]).toMatchObject({
      block: "https://ds.canonical.com/apps_lxd.component.meter",
      tier: "apps_lxd",
    });
  });

  it("skips an empty and a whitespace-only anatomy, and a block with none", async () => {
    await writeFile(join(base, "a.ttl"), block("global.component.a", ""));
    await writeFile(join(base, "b.ttl"), block("global.component.b", "   \n"));
    await writeFile(join(base, "c.ttl"), block("global.component.c", null));
    expect(readCorpus(base).entries).toEqual([]);
  });

  it("keeps the wider graph, so a uri: to an empty anatomy is not dangling", async () => {
    await writeFile(
      join(base, "a.ttl"),
      block("global.component.a", "node:\n"),
    );
    await writeFile(join(base, "b.ttl"), block("global.component.b", null));
    expect(readCorpus(base).store.getSubjects()).toContain(
      "https://ds.canonical.com/global.component.b",
    );
  });

  it("reports a Turtle file it cannot parse, by name, and reads the rest", async () => {
    // The transform wrote these files, so one that does not parse is a defect here
    // and not a fact about the corpus — but the other files are still worth reading,
    // and a stack trace names a line number rather than a remedy.
    await writeFile(join(base, "broken.ttl"), "@prefix ds: <oops");
    await writeFile(
      join(base, "fine.ttl"),
      '@prefix ds: <https://ds.canonical.com/>.\n\nds:global.component.a a ds:Component;\n    ds:anatomyDsl "node:\\n  uri: global.component.a\\n".\n',
    );

    const corpus = readCorpus(base);

    expect(corpus.unparseable).toHaveLength(1);
    expect(corpus.unparseable[0].file).toContain("broken.ttl");
    expect(corpus.unparseable[0].message).toContain("Unexpected");
    expect(corpus.entries).toHaveLength(1);
  });

  it("reads the committed corpus by default, and agrees with the census", () => {
    // The count is not hard-coded here: the census is the committed measurement and
    // its writer is `validate --write-register`, so a corpus that moved is a diff in
    // that file rather than a number two places have to be edited to keep.
    const corpus = readCorpus();
    const census = readCensus();

    expect(census).not.toBeNull();
    expect(corpus.entries).toHaveLength((census as Census).anatomies);
    expect(corpus.unparseable).toHaveLength(
      (census as Census).unparseableFiles,
    );
    // Every anatomy belongs to a tier, and the global tier is the largest — the two
    // facts the derivation's batching depends on.
    const tiers = byTier(corpus.entries);
    expect(Object.values(tiers).reduce((a, b) => a + b, 0)).toBe(
      corpus.entries.length,
    );
    expect(Math.max(...Object.values(tiers))).toBe(tiers.global);
  });
});

describe("byTier", () => {
  it("counts nothing for an empty corpus", () => {
    expect(byTier([])).toEqual({});
  });
});

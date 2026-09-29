import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CENSUS_PATH,
  type Census,
  readCensus,
  renderCensus,
  writeCensus,
} from "./census.js";

function census(overrides: Partial<Census> = {}): Census {
  return {
    anatomies: 134,
    parseable: 0,
    records: 0,
    unparseableFiles: 0,
    symbols: 745,
    unresolved: [],
    categories: {},
    ...overrides,
  };
}

describe("CENSUS_PATH", () => {
  it("is the path the workflows diff and pragma's law reads", () => {
    expect(CENSUS_PATH).toBe("anatomies/census.json");
  });
});

describe("renderCensus", () => {
  it("is deterministic and newline-terminated, which is what makes the diff a gate", () => {
    const text = renderCensus(census());
    expect(text).toBe(renderCensus(census()));
    expect(text.endsWith("\n")).toBe(true);
  });

  it("carries the floors the transform guard reads", () => {
    const parsed = JSON.parse(
      renderCensus(census({ parseable: 134, records: 1300 })),
    );
    expect(parsed.parseable).toBe(134);
    expect(parsed.records).toBe(1300);
  });
});

describe("readCensus and writeCensus", () => {
  let base: string;

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), "census-test-"));
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("returns null when no census is committed, so the guard has no floor to fail", () => {
    expect(readCensus(join(base, "absent.json"))).toBe(null);
  });

  it("round-trips through the filesystem", () => {
    const path = join(base, "census.json");
    writeCensus(census({ unresolved: ["modifier.surface"] }), path);
    expect(readCensus(path)).toEqual(
      census({ unresolved: ["modifier.surface"] }),
    );
  });

  it("returns null rather than crashing on a malformed file", async () => {
    // The census is a floor, not a law: a broken one must not stop the transform from
    // reporting the findings that matter, and `census-drift` rewrites it anyway.
    const path = join(base, "broken.json");
    await writeFile(path, "{not json");
    expect(readCensus(path)).toBe(null);
  });
});

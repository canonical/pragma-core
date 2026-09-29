import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RegisterRow } from "../transform/tokenBindings.js";
import {
  mergeRationale,
  parseRegister,
  REGISTER_PATH,
  readRegister,
  renderRegister,
  rowIdentity,
  sortRows,
  writeRegister,
} from "./register.js";

function row(overrides: Partial<RegisterRow> = {}): RegisterRow {
  return {
    uri: "global.component.button",
    node: "$root",
    key: "appearance.background",
    state: "default",
    value: "modifier.surface",
    category: "X7",
    considered: ["color.foreground.primary"],
    date: "2026-09-09",
    ...overrides,
  };
}

describe("REGISTER_PATH", () => {
  it("is where `validate --write-register` writes the register", () => {
    // Not committed yet, and not diffed by a workflow: the census carries the counts
    // CI gates on. The path is pinned here because the writer, the reader and the
    // guard's own refusal message all name it.
    expect(REGISTER_PATH).toBe("anatomies/register.yaml");
  });
});

describe("rowIdentity", () => {
  it("includes the category, so an X7-plus-X8 element has two identities", () => {
    expect(rowIdentity(row({ category: "X7" }))).not.toBe(
      rowIdentity(row({ category: "X8" })),
    );
  });

  it("spells a null field as a dash rather than dropping it", () => {
    expect(
      rowIdentity(row({ uri: null, node: null, key: null, state: null })),
    ).toBe("- | - | - | - | modifier.surface | X7");
  });
});

describe("sortRows", () => {
  it("orders by category numerically, so X15 follows X2 and not X1", () => {
    const rows = [
      row({ category: "X15", value: "hover.color.foreground.secondary" }),
      row({ category: "X2", value: "spacing.small" }),
      row({ category: "X1", value: "motion.duration.fast" }),
    ];
    expect(sortRows(rows).map((entry) => entry.category)).toEqual([
      "X1",
      "X2",
      "X15",
    ]);
  });

  it("orders within a category by identity, and leaves the input alone", () => {
    const rows = [row({ value: "modifier.surface.hover" }), row()];
    expect(sortRows(rows).map((entry) => entry.value)).toEqual([
      "modifier.surface",
      "modifier.surface.hover",
    ]);
    expect(rows[0].value).toBe("modifier.surface.hover");
  });

  it("sorts a category it cannot read as a number last", () => {
    const rows = [row({ category: "XX" }), row({ category: "X7" })];
    expect(sortRows(rows).map((entry) => entry.category)).toEqual(["X7", "XX"]);
  });
});

describe("renderRegister and parseRegister", () => {
  it("round-trips rows, counts and rationale", () => {
    const register = {
      categories: {
        X7: { count: 1 },
        X10: { count: 0, reason: "the token side checks this" },
      },
      rows: [row({ rationale: "defined by the importance shim" })],
    };
    const parsed = parseRegister(renderRegister(register));
    expect(parsed).toEqual(register);
  });

  it("writes the header comment, so the file explains its own single writer", () => {
    const text = renderRegister({ categories: {}, rows: [] });
    expect(text).toContain("only writer");
    expect(text).toContain("anatomies validate --write-register");
  });

  it("gives a zero count a reason, so an empty category is explained", () => {
    const text = renderRegister({
      categories: { X6: { count: 0 } },
      rows: [],
    });
    expect(text).toContain("no instance in the corpus");
  });

  it("omits the reason on a non-zero count", () => {
    const text = renderRegister({ categories: { X7: { count: 3 } }, rows: [] });
    expect(text).toContain("X7: { count: 3 }");
  });

  it("is deterministic, which is what makes the diff a gate", () => {
    const register = {
      categories: { X7: { count: 2 } },
      rows: [row({ value: "modifier.outline", key: null, node: null }), row()],
    };
    expect(renderRegister(register)).toBe(renderRegister(register));
  });

  it("reads an empty document as an empty register", () => {
    expect(parseRegister("")).toEqual({ categories: {}, rows: [] });
    expect(parseRegister("categories: {}\nrows: []\n")).toEqual({
      categories: {},
      rows: [],
    });
  });

  it("normalises a row that omits considered", () => {
    const parsed = parseRegister(
      "rows:\n  - uri: null\n    node: null\n    key: null\n    state: null\n    value: modifier.surface\n    category: X7\n    date: 2026-09-10\n",
    );
    expect(parsed.rows[0].considered).toEqual([]);
    expect(parsed.rows[0].rationale).toBeUndefined();
    expect(parsed.rows[0].date).toBe("2026-09-10");
  });
});

describe("mergeRationale", () => {
  it("carries a rationale onto a regenerated row with the same identity", () => {
    const merged = mergeRationale(
      [row()],
      [row({ rationale: "no family's context rebinds a base symbol for it" })],
    );
    expect(merged[0].rationale).toBe(
      "no family's context rebinds a base symbol for it",
    );
  });

  it("does not carry it onto a row whose category differs", () => {
    const merged = mergeRationale(
      [row({ category: "X8" })],
      [row({ category: "X7", rationale: "the shim" })],
    );
    expect(merged[0].rationale).toBeUndefined();
  });

  it("keeps a rationale the derivation itself supplied", () => {
    const merged = mergeRationale(
      [row({ rationale: "derived" })],
      [row({ rationale: "on disk" })],
    );
    expect(merged[0].rationale).toBe("derived");
  });

  it("ignores an empty rationale on disk rather than writing one back", () => {
    expect(
      mergeRationale([row()], [row({ rationale: "" })])[0].rationale,
    ).toBeUndefined();
  });
});

describe("readRegister and writeRegister", () => {
  let base: string;

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), "register-test-"));
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("treats a missing file as an empty register, not an error", () => {
    expect(readRegister(join(base, "absent.yaml"))).toEqual({
      categories: {},
      rows: [],
    });
  });

  it("round-trips through the filesystem", async () => {
    const path = join(base, "register.yaml");
    const register = { categories: { X7: { count: 1 } }, rows: [row()] };
    writeRegister(register, path);
    expect(readRegister(path)).toEqual(register);
    expect(await readFile(path, "utf-8")).toContain("modifier.surface");
  });

  it("refuses a malformed document rather than reading it as empty", async () => {
    const path = join(base, "broken.yaml");
    await writeFile(path, "rows:\n  - [a, b]: :\n    x\n");
    expect(() => readRegister(path)).toThrow("does not parse");
  });

  it("refuses a row missing a required field, naming the field and the row", async () => {
    const path = join(base, "incomplete.yaml");
    await writeFile(
      path,
      "rows:\n  - value: modifier.surface\n    category: X7\n",
    );
    expect(() => readRegister(path)).toThrow("row 1 is missing `date`");
  });

  it("propagates a read failure that is not a missing file", () => {
    // A directory, not a file: the guard must not read that as "no exceptions".
    expect(() => readRegister(base)).toThrow();
  });
});

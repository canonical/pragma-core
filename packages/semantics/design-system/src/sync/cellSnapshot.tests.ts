import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AnatomyTable } from "./anatomyTable.js";
import planRestore, {
  type CellSnapshot,
  parseSnapshot,
  SNAPSHOT_DIR,
  snapshotOf,
  snapshotPath,
  snapshotStamp,
  writeSnapshotFile,
} from "./cellSnapshot.js";
import { indexBlocks } from "./liveBlocks.js";

const TABLE: AnatomyTable = {
  document: "NyzE_TLZDh",
  table: "grid-blocks",
  anatomyColumn: "anatomy_dsl",
  uriColumn: "uri",
  path: "fixture.json",
};

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "cell-snapshot-test-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("snapshotStamp and snapshotPath", () => {
  it("stamps with an ISO timestamp whose colons and dots are replaced", () => {
    // A filename with colons in it is legal here and awkward everywhere else, and
    // the milliseconds are what keep two runs in one second from colliding.
    const stamp = snapshotStamp(new Date("2026-09-13T09:41:07.123Z"));
    expect(stamp).toBe("2026-09-13T09-41-07-123Z");
    expect(snapshotStamp()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/,
    );
  });

  it("names the table in the filename, under the gitignored directory", () => {
    expect(snapshotPath("stamp")).toBe(`${SNAPSHOT_DIR}/stamp-uiBlocks.json`);
    expect(SNAPSHOT_DIR).toBe("anatomies/snapshots");
  });
});

describe("snapshotOf", () => {
  it("carries the document, the table, the stamp and every live row", () => {
    // Every row, not only the rows the plan changes: a snapshot of what was about to
    // change cannot put the table back.
    const snapshot = snapshotOf(
      TABLE,
      indexBlocks([
        { rowId: "i-1", uri: "global.component.button", anatomyDsl: "a" },
        { rowId: "i-2", uri: "", anatomyDsl: "b" },
      ]),
      "stamp",
    );

    expect(snapshot.document).toBe("NyzE_TLZDh");
    expect(snapshot.table).toBe("uiBlocks");
    expect(snapshot.takenAt).toBe("stamp");
    expect(snapshot.rows).toHaveLength(2);
  });
});

describe("parseSnapshot", () => {
  it("reads what snapshotOf wrote, through JSON", () => {
    const written = JSON.stringify(
      snapshotOf(
        TABLE,
        indexBlocks([
          { rowId: "i-1", uri: "global.component.button", anatomyDsl: "a" },
        ]),
        "stamp",
      ),
    );
    const read = parseSnapshot(JSON.parse(written));

    expect(read.document).toBe("NyzE_TLZDh");
    expect(read.takenAt).toBe("stamp");
    expect(read.rows).toEqual([
      { rowId: "i-1", uri: "global.component.button", anatomyDsl: "a" },
    ]);
  });

  it("refuses anything that is not a snapshot rather than guessing", () => {
    // This file is the input to a write: a file that is nearly a snapshot would
    // restore nearly the right document, which is the failure nobody notices.
    expect(() => parseSnapshot(null)).toThrow("not a snapshot");
    expect(() => parseSnapshot([])).toThrow("not a snapshot");
    expect(() => parseSnapshot({ rows: "many" })).toThrow(
      "expected an object with a `rows` array",
    );
  });

  it("refuses a row that is not a row, and says which one", () => {
    expect(() => parseSnapshot({ rows: [{ rowId: "i-1" }] })).toThrow("row 0");
    expect(() =>
      parseSnapshot({
        rows: [
          { rowId: "i-1", uri: "a", anatomyDsl: "x" },
          { rowId: "i-2", uri: "b", anatomyDsl: 7 },
        ],
      }),
    ).toThrow("row 1");
    expect(() => parseSnapshot({ rows: [null] })).toThrow("row 0");
    expect(() =>
      parseSnapshot({ rows: [{ rowId: 1, uri: "a", anatomyDsl: "x" }] }),
    ).toThrow("row 0");
    expect(() =>
      parseSnapshot({ rows: [{ rowId: "i", uri: 1, anatomyDsl: "x" }] }),
    ).toThrow("row 0");
  });

  it("takes an older snapshot that names no document at its word", () => {
    const read = parseSnapshot({ rows: [] });
    expect(read.document).toBe("");
    expect(read.takenAt).toBe("");
  });
});

describe("planRestore", () => {
  it("plans the cells that differ from the snapshot, and nothing else", () => {
    const snapshot: CellSnapshot = {
      document: "NyzE_TLZDh",
      table: "uiBlocks",
      takenAt: "stamp",
      rows: [
        { rowId: "i-1", uri: "global.component.button", anatomyDsl: "old" },
        { rowId: "i-2", uri: "global.component.card", anatomyDsl: "same" },
      ],
    };

    const plan = planRestore(
      snapshot,
      indexBlocks([
        { rowId: "i-1", uri: "global.component.button", anatomyDsl: "new" },
        { rowId: "i-2", uri: "global.component.card", anatomyDsl: "same" },
      ]),
      "anatomies/snapshots/stamp-uiBlocks.json",
    );

    expect(plan.verb).toBe("restore");
    expect(plan.updates).toEqual([
      {
        uri: "global.component.button",
        rowId: "i-1",
        before: "new",
        after: "old",
        source: "anatomies/snapshots/stamp-uiBlocks.json",
      },
    ]);
    expect(plan.unchanged).toEqual(["global.component.card"]);
  });

  it("addresses a row by uri, which is why a re-created row still restores", () => {
    // The row id in the snapshot is where the row lived. It has a new id now, and
    // the cell still goes back, because the plan matches on what the row IS.
    const plan = planRestore(
      {
        document: "NyzE_TLZDh",
        table: "uiBlocks",
        takenAt: "stamp",
        rows: [
          {
            rowId: "i-gone",
            uri: "global.component.button",
            anatomyDsl: "old",
          },
        ],
      },
      indexBlocks([
        { rowId: "i-new", uri: "global.component.button", anatomyDsl: "new" },
      ]),
      "snapshot.json",
    );

    expect(plan.updates[0].rowId).toBe("i-new");
  });

  it("ignores a snapshotted row with no uri, which is not a block", () => {
    const plan = planRestore(
      {
        document: "NyzE_TLZDh",
        table: "uiBlocks",
        takenAt: "stamp",
        rows: [{ rowId: "i-1", uri: "", anatomyDsl: "x" }],
      },
      indexBlocks([]),
      "snapshot.json",
    );

    expect(plan.considered).toBe(0);
    expect(plan.missing).toEqual([]);
  });
});

describe("writeSnapshotFile", () => {
  it("creates the directory it writes into", async () => {
    const path = join(base, "nested", "stamp-uiBlocks.json");
    await writeSnapshotFile(path, '{"rows":[]}');
    expect(await readFile(path, "utf-8")).toBe('{"rows":[]}');
  });
});

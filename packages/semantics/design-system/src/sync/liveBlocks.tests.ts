import { describe, expect, it } from "vitest";
import type { TableRow } from "../providers/index.js";
import type { AnatomyTable } from "./anatomyTable.js";
import readLiveBlocks, {
  blockName,
  type CodaReader,
  cell,
  indexBlocks,
  toLiveBlock,
} from "./liveBlocks.js";

const TABLE: AnatomyTable = {
  document: "doc",
  table: "grid-blocks",
  anatomyColumn: "anatomy_dsl",
  uriColumn: "uri",
  path: "fixture.json",
};

/** A reader over a fixed table, which records what it was asked for. */
function reader(rows: TableRow[]): CodaReader & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async fetchTable(document, table): Promise<TableRow[]> {
      asked.push(`${document}/${table}`);
      return rows;
    },
  };
}

describe("cell", () => {
  it("reads a cell as text", () => {
    expect(cell({ _codaId: "i-1", uri: "global.x" }, "uri")).toBe("global.x");
  });

  it("reads a missing cell and a null cell as the empty string", () => {
    // Never `"undefined"`: a cell that says nothing and a cell that says the word
    // "undefined" are different cells, and only one of them is a defect.
    expect(cell({ _codaId: "i-1" }, "uri")).toBe("");
    expect(cell({ _codaId: "i-1", uri: null }, "uri")).toBe("");
  });
});

describe("blockName", () => {
  it("reads a uri with or without the ds: prefix as one block", () => {
    expect(blockName("ds:global.component.button")).toBe(
      "global.component.button",
    );
    expect(blockName("global.component.button")).toBe(
      "global.component.button",
    );
  });
});

describe("toLiveBlock", () => {
  it("reduces a row to the row id, the uri and the cell", () => {
    expect(
      toLiveBlock(
        {
          _codaId: "i-1",
          uri: "ds:global.component.button",
          anatomy_dsl: "node:\n",
          name: "Button",
        },
        TABLE,
      ),
    ).toEqual({
      rowId: "i-1",
      uri: "global.component.button",
      anatomyDsl: "node:\n",
    });
  });
});

describe("indexBlocks", () => {
  it("indexes by uri and keeps every row for the snapshot", () => {
    // The row with no `uri` is not a block — the transform skips it too — so it is
    // not addressable by the plan. It stays in `rows`, because the snapshot is what
    // the document held and a snapshot that dropped rows would restore a different
    // document.
    const live = indexBlocks([
      { rowId: "i-1", uri: "global.component.button", anatomyDsl: "a" },
      { rowId: "i-2", uri: "", anatomyDsl: "b" },
    ]);

    expect([...live.byUri.keys()]).toEqual(["global.component.button"]);
    expect(live.rows).toHaveLength(2);
  });
});

describe("readLiveBlocks", () => {
  it("reads the configured table of the configured document", async () => {
    const source = reader([
      { _codaId: "i-1", uri: "global.component.button", anatomy_dsl: "node:" },
    ]);

    const live = await readLiveBlocks(source, TABLE);

    expect(source.asked).toEqual(["doc/grid-blocks"]);
    expect(live.byUri.get("global.component.button")).toEqual({
      rowId: "i-1",
      uri: "global.component.button",
      anatomyDsl: "node:",
    });
  });

  it("reads the columns the configuration names, whatever they are called", async () => {
    // The column names come from `source.json`, so a table whose columns are spelled
    // differently is read correctly without a line of code changing.
    const source = reader([
      { _codaId: "i-1", slug: "ds:global.component.button", dsl: "node:" },
    ]);

    const live = await readLiveBlocks(source, {
      ...TABLE,
      anatomyColumn: "dsl",
      uriColumn: "slug",
    });

    expect(live.byUri.get("global.component.button")).toEqual({
      rowId: "i-1",
      uri: "global.component.button",
      anatomyDsl: "node:",
    });
  });
});

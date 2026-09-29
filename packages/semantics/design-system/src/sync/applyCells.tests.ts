import { afterEach, describe, expect, it, vi } from "vitest";
import type { ColumnMetadata, TableRow } from "../providers/index.js";
import type { AnatomyTable } from "./anatomyTable.js";
import applyCells, { type CellWriter } from "./applyCells.js";
import { SETTLE_MS, THROTTLE_MS } from "./constants.js";
import type { CellUpdate } from "./planCells.js";

const TABLE: AnatomyTable = {
  document: "doc",
  table: "grid-blocks",
  anatomyColumn: "anatomy_dsl",
  uriColumn: "uri",
  path: "fixture.json",
};

afterEach(() => {
  vi.useRealTimers();
});

/** The columns the table really has, as the API lists them. */
function columns(names: string[]): ColumnMetadata[] {
  return names.map((name) => ({
    id: `c-${name}`,
    name,
    type: "text",
    format: {} as ColumnMetadata["format"],
  }));
}

interface Recorded {
  rowId: string;
  cells: Record<string, string>;
}

/**
 * A stateful fake document: an update lands, and a read sees it.
 *
 * Stateful because the reconcile is the half worth testing — a fake that never
 * changed would make every apply report a mismatch and a converged run untestable.
 * It keeps the rule the real API imposes: a write is addressed by column ID.
 */
function fake(
  options: { swallow?: boolean; drop?: boolean; columns?: string[] } = {},
) {
  const rows: TableRow[] = [
    {
      _codaId: "i-button",
      uri: "global.component.button",
      anatomy_dsl: "the old literal",
    },
  ];
  const writes: Recorded[] = [];
  const provider: CellWriter & { writes: Recorded[] } = {
    writes,
    async fetchTable(): Promise<TableRow[]> {
      return options.drop === true ? [] : rows;
    },
    async fetchTableColumns(): Promise<ColumnMetadata[]> {
      return columns(options.columns ?? ["uri", "anatomy_dsl", "name"]);
    },
    async updateRow(_document, _table, rowId, cells) {
      writes.push({ rowId, cells });
      if (options.swallow === true) {
        // What the API does when a write is keyed wrongly: 202, and nothing changes.
        return {};
      }
      const row = rows.find((candidate) => candidate._codaId === rowId);
      for (const [column, value] of Object.entries(cells)) {
        (row as TableRow)[column.replace(/^c-/, "")] = value;
      }
      return {};
    },
  };
  return provider;
}

const UPDATE: CellUpdate = {
  uri: "global.component.button",
  rowId: "i-button",
  before: "the old literal",
  after: "node:\n  uri: global.component.button\n",
  source: "anatomies/authored/global/global.component.button.yaml",
};

/** Run an apply, recording what it slept for instead of sleeping. */
async function run(provider: CellWriter, updates: CellUpdate[] = [UPDATE]) {
  const slept: number[] = [];
  const outcome = await applyCells({
    provider,
    table: TABLE,
    updates,
    sleep: async (ms) => {
      slept.push(ms);
    },
  });
  return { outcome, slept };
}

describe("applyCells", () => {
  it("sends the file's text to the anatomy_dsl column, by id, and reconciles", async () => {
    const provider = fake();
    const { outcome, slept } = await run(provider);

    // One column, addressed by its id: the name, the tier and the type are the pull
    // sync's and a human editor's, and this write must not be able to reach them.
    expect(provider.writes).toEqual([
      { rowId: "i-button", cells: { "c-anatomy_dsl": UPDATE.after } },
    ]);
    expect(outcome).toEqual({ writes: 1, mismatches: [] });
    expect(slept).toEqual([THROTTLE_MS, SETTLE_MS]);
  });

  it("paces every write and waits the queue out once before it reads back", async () => {
    // One throttle per call — an unthrottled batch trips a 429 — and one settle for
    // the batch, because what it waits for is the document catching up at all.
    const { slept } = await run(fake(), [UPDATE, UPDATE]);
    expect(slept).toEqual([THROTTLE_MS, THROTTLE_MS, SETTLE_MS]);
  });

  it("reports a cell the document accepted and never changed", async () => {
    // The silent failure this whole re-read exists for: 202, queued, and the cell
    // still says what it said. Nothing else would report it.
    const { outcome } = await run(fake({ swallow: true }));

    expect(outcome.writes).toBe(1);
    expect(outcome.mismatches).toEqual([
      {
        uri: "global.component.button",
        rowId: "i-button",
        expected: UPDATE.after,
        found: "the old literal",
      },
    ]);
  });

  it("reports a row that is no longer there as holding nothing", async () => {
    const { outcome } = await run(fake({ drop: true }));
    expect(outcome.mismatches[0].found).toBe("");
  });

  it("writes nothing for an empty plan, and reconciles nothing", async () => {
    const provider = fake();
    const { outcome, slept } = await run(provider, []);

    expect(provider.writes).toEqual([]);
    expect(outcome).toEqual({ writes: 0, mismatches: [] });
    expect(slept).toEqual([SETTLE_MS]);
  });

  it("refuses before any write when a configured column is not there", async () => {
    // A write keyed on a column the table does not have is accepted with a 202 and
    // changes nothing, so the column names are resolved to ids first — by the same
    // helper the roster sync uses — and a name that resolves to nothing refuses.
    const provider = fake({ columns: ["uri", "name"] });
    await expect(
      applyCells({
        provider,
        table: TABLE,
        updates: [UPDATE],
        sleep: async () => {},
      }),
    ).rejects.toThrow('Coda column "anatomy_dsl" not found');
    expect(provider.writes).toEqual([]);
  });

  it("refuses when the identity column is not there either, though it writes none of it", async () => {
    // Only the anatomy column is written, but a wrong identity column would make
    // every row read as absent and every authored file as stale. Refusing names the
    // column instead.
    const provider = fake({ columns: ["anatomy_dsl", "name"] });
    await expect(
      applyCells({
        provider,
        table: TABLE,
        updates: [UPDATE],
        sleep: async () => {},
      }),
    ).rejects.toThrow('Coda column "uri" not found');
  });

  it("waits on a real clock when no sleep is injected", async () => {
    // The default seam. On the fake clock, so the suite does not spend the throttle
    // and the settle in real seconds.
    vi.useFakeTimers();
    const provider = fake();
    const settled = applyCells({
      provider,
      table: TABLE,
      updates: [UPDATE],
    });
    await vi.runAllTimersAsync();

    expect(await settled).toEqual({ writes: 1, mismatches: [] });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ColumnMetadata,
  MutationStatus,
  RowUpdateResult,
  TableRow,
} from "../providers/index.js";
import type { AnatomyTable } from "./anatomyTable.js";
import applyCells, { type CellWriter } from "./applyCells.js";
import {
  MUTATION_POLL_MAX_MS,
  MUTATION_POLL_START_MS,
  MUTATION_TIMEOUT_MS,
  SETTLE_MS,
  THROTTLE_MS,
} from "./constants.js";
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

interface FakeOptions {
  /** The API takes the write, answers 202, and the cell never changes. */
  swallow?: boolean;
  drop?: boolean;
  columns?: string[];
  /** The document never reports the mutation applied. */
  neverCompletes?: boolean;
  /** The write comes back without a `requestId`, so there is nothing to poll. */
  noRequestId?: boolean;
  /** The status call itself fails — an expired id answers 400, for one. */
  statusFails?: boolean;
}

/**
 * A stateful fake document: an update lands, and a read sees it.
 *
 * Stateful because the reconcile is the half worth testing — a fake that never
 * changed would make every apply report a mismatch and a converged run untestable.
 * It keeps the two rules the real API imposes: a write is addressed by column ID,
 * and it is answered with a `requestId` whose mutation is completed separately.
 */
function fake(options: FakeOptions = {}) {
  const rows: TableRow[] = [
    {
      _codaId: "i-button",
      uri: "global.component.button",
      anatomy_dsl: "the old literal",
    },
  ];
  const writes: Recorded[] = [];
  const polled: string[] = [];
  const provider: CellWriter & { writes: Recorded[]; polled: string[] } = {
    writes,
    polled,
    async fetchTable(): Promise<TableRow[]> {
      return options.drop === true ? [] : rows;
    },
    async fetchTableColumns(): Promise<ColumnMetadata[]> {
      return columns(options.columns ?? ["uri", "anatomy_dsl", "name"]);
    },
    async updateRow(_document, _table, rowId, cells): Promise<RowUpdateResult> {
      writes.push({ rowId, cells });
      const accepted = {
        id: rowId,
        requestId: `r-${writes.length}`,
      } as RowUpdateResult;
      if (options.noRequestId === true) {
        // Not a documented shape, but a write reported as unfollowable beats a
        // crash in the middle of a batch.
        return {} as RowUpdateResult;
      }
      if (options.swallow === true) {
        // What the API does when the document will not take the content: 202, a
        // request id, a mutation that completes, and nothing changed.
        return accepted;
      }
      const row = rows.find((candidate) => candidate._codaId === rowId);
      for (const [column, value] of Object.entries(cells)) {
        (row as TableRow)[column.replace(/^c-/, "")] = value;
      }
      return accepted;
    },
    async getMutationStatus(requestId): Promise<MutationStatus> {
      polled.push(requestId);
      if (options.statusFails === true) {
        throw new Error("Coda API error: 400 Bad Request");
      }
      return { completed: options.neverCompletes !== true };
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
    expect(outcome).toEqual({
      writes: 1,
      mutations: [
        {
          uri: "global.component.button",
          rowId: "i-button",
          requestId: "r-1",
          completed: true,
          waitedMs: 0,
          error: null,
        },
      ],
      mismatches: [],
    });
    // A mutation already applied by the time the batch ended costs one status call
    // and no wait at all.
    expect(provider.polled).toEqual(["r-1"]);
    expect(slept).toEqual([THROTTLE_MS, SETTLE_MS]);
  });

  it("paces every write and follows each one's own mutation", async () => {
    // One throttle per call — an unthrottled batch trips a 429 — then every write's
    // requestId asked about in turn, and one settle: `completed` is the document
    // having applied the mutation, not a promise the next read is served it.
    const provider = fake();
    const { slept, outcome } = await run(provider, [UPDATE, UPDATE]);
    expect(provider.polled).toEqual(["r-1", "r-2"]);
    expect(outcome.mutations.map((mutation) => mutation.requestId)).toEqual([
      "r-1",
      "r-2",
    ]);
    expect(slept).toEqual([THROTTLE_MS, THROTTLE_MS, SETTLE_MS]);
  });

  it("reports a cell the document accepted, applied and never changed", async () => {
    // The silent failure this whole re-read exists for: 202, a mutation the document
    // says it completed, and the cell still says what it said. Nothing else would
    // report it, and the completed mutation is what says the document itself is
    // refusing the content rather than running late.
    const { outcome } = await run(fake({ swallow: true }));

    expect(outcome.writes).toBe(1);
    expect(outcome.mismatches).toEqual([
      {
        uri: "global.component.button",
        rowId: "i-button",
        expected: UPDATE.after,
        found: "the old literal",
        mutation: {
          uri: "global.component.button",
          rowId: "i-button",
          requestId: "r-1",
          completed: true,
          waitedMs: 0,
          error: null,
        },
      },
    ]);
  });

  it("gives up on a mutation the document never completes, and says how long it waited", async () => {
    const provider = fake({ swallow: true, neverCompletes: true });
    const { outcome, slept } = await run(provider);

    expect(outcome.mutations[0].completed).toBe(false);
    // The bound is time slept, so it is the same on a fake clock as on a real one,
    // and it is the sixty seconds the report names rather than a doubling more.
    expect(outcome.mutations[0].waitedMs).toBe(MUTATION_TIMEOUT_MS);
    const waits = slept.slice(1, -1);
    expect(waits[0]).toBe(MUTATION_POLL_START_MS);
    expect(Math.max(...waits)).toBe(MUTATION_POLL_MAX_MS);
    expect(waits.reduce((total, wait) => total + wait, 0)).toBe(
      MUTATION_TIMEOUT_MS,
    );
    // One more status call than waits: the first is asked before anything is slept
    // and the last after the bound is spent.
    expect(provider.polled).toHaveLength(waits.length + 1);
    expect(outcome.mismatches[0].mutation.completed).toBe(false);
  });

  it("follows nothing when the write came back without a request id", async () => {
    const provider = fake({ noRequestId: true, swallow: true });
    const { outcome, slept } = await run(provider);

    expect(provider.polled).toEqual([]);
    expect(outcome.mutations[0]).toEqual({
      uri: "global.component.button",
      rowId: "i-button",
      requestId: null,
      completed: false,
      waitedMs: 0,
      error: null,
    });
    expect(slept).toEqual([THROTTLE_MS, SETTLE_MS]);
  });

  it("records a failed status call against the mutation and still reconciles", async () => {
    // The writes have been issued by the time the poll runs, so a status call that
    // throws must not take the re-read down with it: the re-read is the only thing
    // that can say what the document actually holds.
    const provider = fake({ statusFails: true });
    const { outcome, slept } = await run(provider);

    expect(outcome.mutations[0].error).toBe("Coda API error: 400 Bad Request");
    expect(outcome.mutations[0].completed).toBe(false);
    expect(outcome.mismatches).toEqual([]);
    expect(slept).toEqual([THROTTLE_MS, SETTLE_MS]);
  });

  it("reports a row that is no longer there as holding nothing", async () => {
    const { outcome } = await run(fake({ drop: true }));
    expect(outcome.mismatches[0].found).toBe("");
  });

  it("writes nothing for an empty plan, and reconciles nothing", async () => {
    const provider = fake();
    const { outcome, slept } = await run(provider, []);

    expect(provider.writes).toEqual([]);
    expect(provider.polled).toEqual([]);
    expect(outcome).toEqual({ writes: 0, mutations: [], mismatches: [] });
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

    expect(await settled).toEqual({
      writes: 1,
      mutations: [
        {
          uri: "global.component.button",
          rowId: "i-button",
          requestId: "r-1",
          completed: true,
          waitedMs: 0,
          error: null,
        },
      ],
      mismatches: [],
    });
  });
});

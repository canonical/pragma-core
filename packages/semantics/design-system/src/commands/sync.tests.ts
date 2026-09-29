import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodaProvider } from "../providers/index.js";
import sync, { applyPlan } from "./sync.js";

vi.mock("node:fs/promises");
vi.mock("../providers/index.js");

const SPEC = {
  scope: { documentId: "doc", table: "grid-x", tiers: ["Global/Form"] },
  entries: [
    {
      rowId: "i-1",
      target: { name: "TextField", tier: "Global/Form", type: "Component" },
      op: "rename",
    },
  ],
};

const COLUMNS = [
  { id: "c-name", name: "name", type: "text", format: {} },
  { id: "c-tier", name: "tier", type: "lookup", format: {} },
  { id: "c-type", name: "type", type: "lookup", format: {} },
];

/** A live row matching SPEC's entry, in its pre-rename ("Text") state. */
function liveRowText() {
  return [
    {
      _codaId: "i-1",
      name: "Text",
      tier: { id: "t", name: "Global/Form" },
      type: { id: "y", name: "Component" },
    },
  ];
}

/** A live row already renamed to "TextField" (post-apply state). */
function liveRowTextField() {
  return [
    {
      _codaId: "i-1",
      name: "TextField",
      tier: { id: "t", name: "Global/Form" },
      type: { id: "y", name: "Component" },
    },
  ];
}

describe("sync", () => {
  beforeEach(() => {
    vi.mocked(readFile).mockReset();
    vi.mocked(writeFile).mockReset().mockResolvedValue();
    vi.mocked(CodaProvider).mockReset();
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(SPEC));
  });

  it("dry-run reads and diffs but performs no writes", async () => {
    const fetchTable = vi.fn().mockResolvedValue(liveRowText());
    const updateRow = vi.fn();
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return { fetchTable, updateRow } as unknown as CodaProvider;
    });

    const plan = await sync({ specPath: "spec.json", apply: false });

    expect(plan.ops.at(0)?.kind).toBe("rename");
    expect(updateRow).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled(); // no snapshot in dry-run
  });

  it("uses the 'unstamped' snapshot name when no stamp is given", async () => {
    const fetchTable = vi.fn().mockResolvedValue(liveRowTextField()); // already applied → no ops
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return { fetchTable, fetchTableColumns } as unknown as CodaProvider;
    });

    await sync({ specPath: "spec.json", apply: true }); // no stamp

    expect(writeFile).toHaveBeenCalledWith(
      "coda-snapshot-unstamped.json",
      expect.any(String),
      "utf-8",
    );
  });

  it("refuses --apply when guardrails are violated", async () => {
    // target row id absent from live → "not found in live Coda" violation
    const fetchTable = vi.fn().mockResolvedValue([]);
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return { fetchTable } as unknown as CodaProvider;
    });

    await expect(sync({ specPath: "spec.json", apply: true })).rejects.toThrow(
      "guardrail violation",
    );
  });

  it("applies (snapshot + write with column IDs) then reconciles to zero residual ops", async () => {
    // First fetch: pre-rename (one op). Every fetch after apply: already renamed
    // (zero ops) → reconcile converges on pass 2. Real timers (the throttle/
    // settle delays are short for a single op); cs:testing prefers real
    // execution over timer mocks.
    // Call 1 = initial read (pre-rename, one op). Calls 2+ = post-apply reads
    // (already renamed → zero ops), so reconcile converges.
    let fetchCount = 0;
    const fetchTable = vi.fn().mockImplementation(() => {
      fetchCount += 1;
      return Promise.resolve(
        fetchCount === 1 ? liveRowText() : liveRowTextField(),
      );
    });
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const updateRow = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        updateRow,
      } as unknown as CodaProvider;
    });

    const plan = await sync({ specPath: "spec.json", apply: true, stamp: "t" });

    expect(writeFile).toHaveBeenCalledOnce(); // snapshot taken
    // Lookup columns (tier/type) are written by their option ROW-ID, learned
    // from the live rows ({id,name}): Global/Form→"t", Component→"y". Only the
    // plain-text `name` column is written as a string.
    expect(updateRow).toHaveBeenCalledWith("doc", "grid-x", "i-1", {
      "c-name": "TextField",
      "c-tier": "t",
      "c-type": "y",
    });
    // reconcile re-read and found no residual *pending* ops (the rename re-diffs
    // as the same op but with empty changedFields → already applied).
    const stillPending = plan.ops.filter(
      (op) =>
        op.kind === "create" ||
        (op.kind === "merge" && op.before !== null) ||
        (op.kind !== "keep" &&
          op.kind !== "merge" &&
          op.changedFields.length > 0),
    );
    expect(stillPending).toEqual([]);
  }, 15000);

  it("applies a deletion (merge) via deleteRows, ordered after writes", async () => {
    const specWithMerge = {
      scope: SPEC.scope,
      entries: [
        { rowId: "i-9", target: null, op: "merge", mergeInto: "i-keep" },
      ],
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(specWithMerge));

    const mergeRow = {
      _codaId: "i-9",
      name: "Old",
      tier: { id: "t", name: "Global/Form" },
      type: { id: "y", name: "Component" },
    };
    const keepRow = {
      _codaId: "i-keep",
      name: "Keep",
      tier: { id: "t", name: "Global/Form" },
      type: { id: "y", name: "Component" },
    };
    // Call 1: both rows present (merge pending). Call 2+: merge row gone.
    let n = 0;
    const fetchTable = vi.fn().mockImplementation(() => {
      n += 1;
      return Promise.resolve(n === 1 ? [mergeRow, keepRow] : [keepRow]);
    });
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const deleteRows = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        deleteRows,
      } as unknown as CodaProvider;
    });

    await sync({ specPath: "spec.json", apply: true, stamp: "t" });

    expect(deleteRows).toHaveBeenCalledWith("doc", "grid-x", ["i-9"]);
  }, 15000);

  it("applies a create via createRow", async () => {
    const specWithCreate = {
      scope: SPEC.scope,
      entries: [
        {
          rowId: null,
          target: { name: "NewField", tier: "Global/Form", type: "Component" },
          op: "create",
        },
      ],
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(specWithCreate));

    const created = {
      _codaId: "i-new",
      name: "NewField",
      tier: { id: "t", name: "Global/Form" },
      type: { id: "y", name: "Component" },
    };
    // Call 1: empty (create pending). Call 2+: the created row present → converged.
    let n = 0;
    const fetchTable = vi.fn().mockImplementation(() => {
      n += 1;
      return Promise.resolve(n === 1 ? [] : [created]);
    });
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const createRow = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        createRow,
      } as unknown as CodaProvider;
    });

    await sync({ specPath: "spec.json", apply: true, stamp: "t" });

    // Initial fetch is empty, so tier/type resolve via the static LOOKUP_OPTION
    // seed to their option row-ids (exercises the seed-hit branch).
    expect(createRow).toHaveBeenCalledWith("doc", "grid-x", {
      "c-name": "NewField",
      "c-tier": "i-coQYYw48ct",
      "c-type": "i-w6UO-xh8Qh",
    });
  }, 15000);

  it("does NOT re-create a row across passes when Coda hasn't surfaced it yet", async () => {
    // Regression guard: a freshly-created row may be invisible to the next
    // re-fetch (Coda eventual consistency). The create must be issued ONCE and
    // suppressed thereafter — re-firing it caused duplicate rows.
    const specWithCreate = {
      scope: SPEC.scope,
      entries: [
        {
          rowId: null,
          target: { name: "NewField", tier: "Global/Form", type: "Component" },
          op: "create",
        },
      ],
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(specWithCreate));

    // Every fetch returns empty → the naive loop would re-create each pass.
    const fetchTable = vi.fn().mockResolvedValue([]);
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const createRow = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        createRow,
      } as unknown as CodaProvider;
    });

    await sync({ specPath: "spec.json", apply: true, stamp: "t" });

    expect(createRow).toHaveBeenCalledTimes(1); // issued once, not per pass
  }, 40000);

  it("throws if a required source column is missing", async () => {
    const fetchTable = vi.fn().mockResolvedValue(liveRowText());
    // columns missing `tier`/`type` → buildColumnIdMap throws
    const fetchTableColumns = vi
      .fn()
      .mockResolvedValue([
        { id: "c-name", name: "name", type: "text", format: {} },
      ]);
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
      } as unknown as CodaProvider;
    });

    await expect(
      sync({ specPath: "spec.json", apply: true, stamp: "t" }),
    ).rejects.toThrow('Coda column "tier" not found');
  }, 15000);

  it("warns when ops remain unapplied after the reconcile passes", async () => {
    // fetchTable always returns the pre-rename row → op never converges →
    // residual warning path. updateRow is a no-op (simulates a silent drop).
    const fetchTable = vi.fn().mockResolvedValue(liveRowText());
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const updateRow = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        updateRow,
      } as unknown as CodaProvider;
    });

    const warn = vi.spyOn(console, "log");
    await sync({ specPath: "spec.json", apply: true, stamp: "t" });

    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("still unapplied")),
    ).toBe(true);
    warn.mockRestore();
  }, 40000);

  it("refuses to silently skip an orphan op that matches no executor (T-C1)", async () => {
    // applyPlan partitions ops into create/update/deletion executors; an op whose
    // kind/shape matches none (here a "rename" with rowId null → fails isUpdate's
    // rowId!==null guard, and is neither create nor merge) must throw rather than
    // be dropped. Drive applyPlan directly with a fake provider.
    const provider = {
      createRow: vi.fn(),
      updateRow: vi.fn(),
      deleteRows: vi.fn(),
    } as unknown as CodaProvider;
    const orphanPlan = {
      ops: [
        {
          kind: "rename" as const,
          rowId: null,
          before: null,
          after: null,
          changedFields: [],
        },
      ],
      violations: [],
      unmanaged: [],
    };
    // columnId is keyed by the COLUMN display values name/tier/type → column ids.
    const columnId = { name: "c-name", tier: "c-tier", type: "c-type" };
    const lookupId = { tier: {}, type: {} };

    await expect(
      applyPlan(provider, SPEC as never, orphanPlan, columnId, lookupId),
    ).rejects.toThrow("matched no executor");
    expect(provider.createRow).not.toHaveBeenCalled();
    expect(provider.updateRow).not.toHaveBeenCalled();
    expect(provider.deleteRows).not.toHaveBeenCalled();
  });

  it("throws when a lookup value resolves to no Coda option row-id (T-C3)", async () => {
    // A create whose tier is in the scope fence (so diffRoster raises no scope
    // violation) but is absent from both the empty live rows and the static seed
    // → resolveLookupValue cannot map it to an option row-id and must throw,
    // rather than writing a silently no-op string.
    const specOrphanTier = {
      scope: {
        documentId: "doc",
        table: "grid-x",
        // "Orphan/Tier" is in scope (passes the fence) but has no seed entry.
        tiers: ["Global/Form", "Orphan/Tier"],
      },
      entries: [
        {
          rowId: null,
          target: { name: "NewField", tier: "Orphan/Tier", type: "Component" },
          op: "create",
        },
      ],
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(specOrphanTier));

    const fetchTable = vi.fn().mockResolvedValue([]); // empty → nothing learned
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const createRow = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        createRow,
      } as unknown as CodaProvider;
    });

    await expect(
      sync({ specPath: "spec.json", apply: true, stamp: "t" }),
    ).rejects.toThrow("cannot resolve");
    expect(createRow).not.toHaveBeenCalled();
  }, 15000);

  it("skips malformed lookup cells when learning the id map without crashing (T-C4)", async () => {
    // buildLookupIdMap → learnLookupCell must skip cells it cannot learn from,
    // not crash: (1) a bare-string `tier` cell (not an object → the non-object
    // branch) and (2) a `type` cell that is a {id,name} object whose `id` is not
    // a string (→ the non-string-value branch). Both are skipped; the static
    // seed still resolves Global/Form and Component, so the apply converges.
    const malformedRow = {
      _codaId: "i-1",
      name: "Text",
      tier: "Global/Form", // bare string → learnLookupCell non-object branch
      type: { id: 123, name: "Component" }, // non-string id → non-string-value branch
    };
    const renamedRow = {
      _codaId: "i-1",
      name: "TextField",
      tier: "Global/Form",
      type: { id: 123, name: "Component" },
    };
    // Call 1: pre-rename (one op). Calls 2+: renamed → reconcile converges.
    let n = 0;
    const fetchTable = vi.fn().mockImplementation(() => {
      n += 1;
      return Promise.resolve(n === 1 ? [malformedRow] : [renamedRow]);
    });
    const fetchTableColumns = vi.fn().mockResolvedValue(COLUMNS);
    const updateRow = vi.fn().mockResolvedValue({});
    vi.mocked(CodaProvider).mockImplementation(function (this: CodaProvider) {
      return {
        fetchTable,
        fetchTableColumns,
        updateRow,
      } as unknown as CodaProvider;
    });

    await expect(
      sync({ specPath: "spec.json", apply: true, stamp: "t" }),
    ).resolves.toBeDefined();
    // Neither malformed cell was learned, so tier/type resolve via the seed.
    expect(updateRow).toHaveBeenCalledWith("doc", "grid-x", "i-1", {
      "c-name": "TextField",
      "c-tier": "i-coQYYw48ct",
      "c-type": "i-w6UO-xh8Qh",
    });
  }, 15000);
});

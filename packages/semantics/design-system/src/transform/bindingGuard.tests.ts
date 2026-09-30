import { afterEach, describe, expect, it, vi } from "vitest";
import type { Census } from "../anatomies/census.js";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore } from "../graph/index.js";
import guardTokenBindings, {
  renderFindings,
  renderSkippedAnatomies,
  runBindingGuard,
  tokenNamespaceOf,
} from "./bindingGuard.js";
import deriveTokenBindings, { type RegisterRow } from "./tokenBindings.js";

const ds = NAMESPACES.ds;

afterEach(() => {
  vi.restoreAllMocks();
});

function storeWith(styles: string): GraphStore {
  const store = new GraphStore();
  store.addLiteral(
    `${ds}global.component.button`,
    PREDICATES.anatomyDsl,
    `node:\n  uri: global.component.button\n  styles:\n${styles}`,
  );
  return store;
}

/** A census carrying only the two fields the guard's floors read. */
function census(records: number, parseable: number): Census {
  return { records, parseable, anatomies: 1 } as Census;
}

describe("tokenNamespaceOf", () => {
  it("reads the imported registry, so the roster is anatomy-dsl's and not a copy", () => {
    expect(tokenNamespaceOf("typography.color")).toContain("color.");
    expect(tokenNamespaceOf("typography.color")).toContain("modifier.color.");
  });

  it("returns undefined for a key the registry does not carry", () => {
    expect(tokenNamespaceOf("not.a.key")).toBeUndefined();
  });
});

describe("renderFindings", () => {
  it("says so plainly when there is nothing to say", () => {
    expect(renderFindings([])).toContain("no findings");
  });

  it("counts findings and warnings separately and marks them differently", () => {
    const text = renderFindings([
      { code: "X11", severity: "finding", message: "dangling" },
      { code: "AT11", severity: "warning", message: "differs" },
    ]);
    expect(text).toContain("1 finding(s), 1 warning(s)");
    expect(text).toContain("✗ [X11]");
    expect(text).toContain("⚠ [AT11]");
  });
});

describe("runBindingGuard — the two census floors", () => {
  const store = () => storeWith("    typography.color: color.text\n");

  it("reports no floors when no census is committed yet", () => {
    const result = runBindingGuard(
      store(),
      {},
      { anatomies: 1, parsed: 1 },
      { census: null },
    );
    expect(result.floors).toBe(null);
    expect(result.findings).toEqual([]);
    expect(result.records).toBe(0);
  });

  it("refuses a parse count below the committed floor, naming the file", () => {
    const result = runBindingGuard(
      store(),
      {},
      { anatomies: 1, parsed: 1 },
      {
        census: census(0, 134),
      },
    );
    const finding = result.findings.find(
      (entry) => entry.code === "PARSE_FLOOR",
    );
    expect(finding?.severity).toBe("finding");
    expect(finding?.message).toContain("anatomies/census.json");
    expect(finding?.message).toContain("134");
  });

  it("refuses a record count below the committed floor", () => {
    const derived = store();
    deriveTokenBindings(derived);
    const result = runBindingGuard(
      derived,
      {},
      { anatomies: 1, parsed: 1 },
      { census: census(99, 1) },
    );
    expect(result.findings.map((entry) => entry.code)).toContain(
      "RECORD_FLOOR",
    );
  });

  it("passes when both floors are met, which is what makes it a ratchet", () => {
    const derived = store();
    deriveTokenBindings(derived);
    expect(
      runBindingGuard(
        derived,
        {},
        { anatomies: 1, parsed: 1 },
        { census: census(1, 1) },
      ).findings,
    ).toEqual([]);
  });

  it("reads the committed register and census when none are injected", () => {
    // The real files, as the transform sees them: this is the path CI takes.
    const result = runBindingGuard(
      storeWith("    layout.type: flow\n"),
      {},
      { anatomies: 1, parsed: 0 },
    );
    expect(result.records).toBe(0);
    expect(result.findings).toEqual([]);
  });
});

describe("guardTokenBindings", () => {
  it("lets a resolving corpus through and says nothing", () => {
    const store = storeWith(
      "    typography.color: [modifier.color.text, color.text]\n",
    );
    deriveTokenBindings(store);
    expect(
      guardTokenBindings(
        store,
        {},
        { anatomies: 1, parsed: 1 },
        { census: null },
      ).records,
    ).toBe(2);
  });

  it("refuses the transform when a record consumes an unregistered symbol", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const store = storeWith(
      "    typography.color: modifier.color.notasymbol\n",
    );
    deriveTokenBindings(store);
    expect(() =>
      guardTokenBindings(
        store,
        {},
        { anatomies: 1, parsed: 1 },
        { census: null },
      ),
    ).toThrow("Refusing to overwrite committed data");
  });

  it("lets an unregistered symbol through with allowUnboundSymbols set", () => {
    const store = storeWith(
      "    typography.color: modifier.color.notasymbol\n",
    );
    deriveTokenBindings(store);
    expect(
      guardTokenBindings(
        store,
        { allowUnboundSymbols: true },
        { anatomies: 1, parsed: 1 },
        {
          census: null,
        },
      ).findings,
    ).toEqual([]);
  });

  it("still refuses a namespace violation under allowUnboundSymbols", () => {
    // §8.2's switch suppresses ONE row of the exit-code table. `modifier.surface` on a
    // `color.*` key is outside the key's namespace set as well as unresolved, and
    // §5.3's invariant says such an element carries an X8 row too — so the X8 finding
    // survives the suppression, which is the pair that proves the switch is narrow.
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const store = storeWith("    appearance.background: modifier.surface\n");
    deriveTokenBindings(store);
    const result = runBindingGuard(
      store,
      { allowUnboundSymbols: true },
      { anatomies: 1, parsed: 1 },
      {
        census: null,
      },
    );
    expect(result.findings.map((entry) => entry.code)).toEqual(["X8"]);
    expect(() =>
      guardTokenBindings(
        store,
        { allowUnboundSymbols: true },
        { anatomies: 1, parsed: 1 },
        {
          census: null,
        },
      ),
    ).toThrow("Refusing to overwrite committed data");
  });

  it("prints a warning and proceeds, which is what makes a warning a warning", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const store = storeWith(
      "    typography.color: color.text\n    typography.color@hover: color.background\n",
    );
    deriveTokenBindings(store);
    expect(
      guardTokenBindings(
        store,
        {},
        { anatomies: 1, parsed: 1 },
        { census: null },
      ).findings,
    ).toHaveLength(1);
    expect(log.mock.calls.flat().join("\n")).toContain("⚠ [AT11]");
  });
});

describe("guardTokenBindings — the register admits the derivation's findings", () => {
  // A cell still in the retired notation is a parse failure the corpus admits by a
  // register row, exactly as `validate` admits it: the transform is the same law in
  // another home, and a registered exception must not stop the daily sync.
  const registered = [
    {
      uri: "global.component.button",
      node: null,
      key: null,
      state: null,
      value: "retired-slash-path",
      category: "X16",
      considered: [],
      rationale: "",
      date: "2026-09-15",
    },
  ] as unknown as RegisterRow[];

  it("lets a registered parse failure through as no finding at all", () => {
    const store = storeWith("    typography.color: color/text\n");
    deriveTokenBindings(store);
    const result = runBindingGuard(
      store,
      {},
      { anatomies: 1, parsed: 0 },
      { census: null, register: registered },
    );
    expect(result.findings.filter((f) => f.severity === "finding")).toEqual([]);
  });

  it("skips and reports the same parse failure when no row admits it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = storeWith("    typography.color: color/text\n");
    deriveTokenBindings(store);
    const result = guardTokenBindings(
      store,
      {},
      { anatomies: 1, parsed: 0 },
      { census: null, register: [] },
    );
    expect(result.findings).toEqual([]);
    expect(result.skipped.map((finding) => finding.code)).toEqual(["X16"]);
    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      expect.stringMatching(
        /^Skipping the anatomy of global\.component\.button — it does not parse, so its token bindings are left out of data\/: /,
      ),
    ]);
  });
});

describe("guardTokenBindings — an anatomy that does not parse is skipped, not refused", () => {
  /** Two blocks: a card whose tree references a label that does not parse. */
  function storeWithBrokenLabel(): GraphStore {
    const store = new GraphStore();
    store.addLiteral(
      `${ds}global.component.card`,
      PREDICATES.anatomyDsl,
      [
        "node:",
        "  uri: global.component.card",
        "  styles:",
        "    typography.color: color.text",
        "  edges:",
        "    - node:",
        "        uri: global.subcomponent.label",
        '      relation: { cardinality: "1", slotName: default }',
        "",
      ].join("\n"),
    );
    store.addLiteral(
      `${ds}global.subcomponent.label`,
      PREDICATES.anatomyDsl,
      "node:\n  uri: global.subcomponent.label\n  styles:\n    typography.weight: font/weight/medium\n",
    );
    return store;
  }

  it("keeps the other block's records and reports the skipped one once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = storeWithBrokenLabel();
    const derivation = deriveTokenBindings(store);
    const result = guardTokenBindings(store, {}, derivation, {
      census: null,
      register: [],
    });
    expect(result.findings).toEqual([]);
    expect(result.records).toBe(1);
    const lines = warn.mock.calls.map(([line]) => line as string);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^Skipping the anatomy of global\.subcomponent\.label — it does not parse, so its token bindings, and those global\.component\.card reach through it, are left out of data\/: /,
    );
    expect(lines[0]).toContain("slash-delimited token path");
  });

  it("skips an anatomy whose YAML has a syntax error, and reports where the error is", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // A duplicate key: the YAML still yields a mapping, so this parsed before, on
    // whichever of the two values the reader kept.
    const store = storeWith(
      "    typography.color: color.text\n    typography.color: color.text.muted\n",
    );
    const derivation = deriveTokenBindings(store);
    const result = guardTokenBindings(store, {}, derivation, {
      census: null,
      register: [],
    });
    expect(derivation.parsed).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.records).toBe(0);
    expect(warn.mock.calls.map(([line]) => line)).toEqual([
      "Skipping the anatomy of global.component.button — it does not parse, so its token bindings are left out of data/: YAML syntax error at line 5, column 5: Map keys must be unique",
    ]);
  });

  it("counts a skipped anatomy toward the parse floor and does not measure the record floor", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = storeWithBrokenLabel();
    const derivation = deriveTokenBindings(store);
    // The committed census says both anatomies parsed and held more records: the label
    // stopped parsing in this run, which is the case that used to stop the sync.
    const result = runBindingGuard(store, {}, derivation, {
      census: { records: 5, parseable: 2, anatomies: 2 } as Census,
      register: [],
    });
    expect(result.findings).toEqual([]);
  });

  it("still refuses every other finding on a run that skipped an anatomy", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const store = storeWithBrokenLabel();
    store.addLiteral(
      `${ds}global.component.chip`,
      PREDICATES.anatomyDsl,
      "node:\n  uri: global.component.chip\n  styles:\n    typography.color: modifier.color.notasymbol\n",
    );
    const derivation = deriveTokenBindings(store);
    expect(() =>
      guardTokenBindings(store, {}, derivation, { census: null, register: [] }),
    ).toThrow("Refusing to overwrite committed data");
  });

  it("still refuses a parse count that fell without a skipped anatomy to account for it", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = storeWithBrokenLabel();
    const derivation = deriveTokenBindings(store);
    const result = runBindingGuard(store, {}, derivation, {
      census: { records: 1, parseable: 3, anatomies: 2 } as Census,
      register: [],
    });
    expect(result.findings.map((finding) => finding.code)).toEqual([
      "PARSE_FLOOR",
    ]);
  });
});

describe("renderSkippedAnatomies", () => {
  it("says nothing when nothing was skipped", () => {
    expect(renderSkippedAnatomies([])).toEqual([]);
  });

  it("keeps a multi-line parse error to its first line, and lists the blocks in order", () => {
    // The sync workflow lists the log lines that start with `Skipping`; a second line
    // of the error would not start with it and would be lost.
    expect(
      renderSkippedAnatomies([
        {
          code: "X16",
          severity: "finding",
          block: `${ds}global.component.table`,
          message: `${ds}global.component.table: ds:anatomyDsl does not parse as an anatomy document — not a mapping`,
        },
        {
          code: "X16",
          severity: "finding",
          block: `${ds}global.component.card`,
          message: `${ds}global.component.card: ds:anatomyDsl does not parse as an anatomy document — bad indentation\n  at line 3`,
        },
      ]),
    ).toEqual([
      "Skipping the anatomy of global.component.card — it does not parse, so its token bindings are left out of data/: bad indentation",
      "Skipping the anatomy of global.component.table — it does not parse, so its token bindings are left out of data/: not a mapping",
    ]);
  });
});

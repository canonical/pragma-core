import { describe, expect, it } from "vitest";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore } from "../graph/index.js";
import type { SymbolIndex } from "./symbols.js";
import deriveTokenBindings, {
  assertBindingsResolve,
  type BindingRecord,
  checkBindings,
  hasFinding,
  type LawInputs,
  NAMESPACE_CATEGORY,
  RESOLUTION_CATEGORIES,
  type RegisterRow,
  readBindingRecords,
} from "./tokenBindings.js";

const ds = NAMESPACES.ds;

/** A symbol index built by hand, so the law is tested without reading a stratum. */
function symbols(...names: string[]): SymbolIndex {
  return { names: new Set(names), channelOf: new Map() };
}

function record(overrides: Partial<BindingRecord> = {}): BindingRecord {
  return {
    block: `${ds}global.component.button`,
    viaBlock: `${ds}global.component.button`,
    node: "$root",
    styleKey: "appearance.background",
    styleState: "default",
    rank: 1,
    symbol: "color.background",
    ...overrides,
  };
}

function row(overrides: Partial<RegisterRow> = {}): RegisterRow {
  return {
    uri: null,
    node: null,
    key: null,
    state: null,
    value: "modifier.surface",
    category: "X7",
    considered: [],
    date: "2026-09-10",
    ...overrides,
  };
}

function law(overrides: Partial<LawInputs> = {}): LawInputs {
  return {
    symbols: symbols("color.background", "color.text", "modifier.color.text"),
    register: [],
    ...overrides,
  };
}

const codes = (findings: { code: string }[]) =>
  findings.map((finding) => finding.code);

describe("checkBindings — the resolution rows of the exit-code table", () => {
  it("passes an element that resolves, with no register row needed", () => {
    expect(checkBindings([record()], law())).toEqual([]);
  });

  it("fails an element that resolves in neither stratum and has no row", () => {
    const findings = checkBindings(
      [record({ symbol: "modifier.surface" })],
      law(),
    );
    expect(codes(findings)).toEqual(["UNRESOLVED"]);
    expect(findings[0].severity).toBe("finding");
    expect(findings[0].message).toContain("modifier.surface");
  });

  it("passes the same element once a resolution row admits it", () => {
    expect(
      checkBindings(
        [record({ symbol: "modifier.surface" })],
        law({
          register: [row()],
        }),
      ),
    ).toEqual([]);
  });

  it("does not let a non-resolution category admit an unresolved element", () => {
    // X4 is leaked CSS, checked against the reference stylesheet, not resolution: it
    // admits nothing here, which is what keeps the register's categories meaningful.
    const findings = checkBindings(
      [record({ symbol: "modifier.surface" })],
      law({ register: [row({ category: "X4" })] }),
    );
    expect(codes(findings)).toContain("UNRESOLVED");
  });

  it("fails when two rows admit one element, because the invariant is exactly one", () => {
    const findings = checkBindings(
      [record({ symbol: "modifier.surface" })],
      law({ register: [row(), row({ category: "X7", date: "2026-09-09" })] }),
    );
    expect(codes(findings)).toContain("AMBIGUOUS");
  });

  it("pins a row that names a binding to that binding and no other", () => {
    const pinned = row({
      uri: "global.component.button",
      node: "$root",
      key: "appearance.background",
      state: "default",
    });
    expect(
      checkBindings(
        [record({ symbol: "modifier.surface" })],
        law({
          register: [pinned],
        }),
      ),
    ).toEqual([]);
    const elsewhere = record({
      symbol: "modifier.surface",
      node: "$root/icon",
    });
    expect(
      codes(checkBindings([elsewhere], law({ register: [pinned] }))),
    ).toContain("UNRESOLVED");
  });

  it("suppresses only the unresolved-symbol finding under allowUnboundSymbols", () => {
    const unresolved = record({ symbol: "modifier.surface" });
    expect(
      checkBindings([unresolved], law({ allowUnboundSymbols: true })),
    ).toEqual([]);
    // Every other row of the table still fails: a stale register row, for instance.
    const findings = checkBindings(
      [unresolved],
      law({
        allowUnboundSymbols: true,
        register: [row({ value: "color.text", key: "typography.color" })],
      }),
    );
    expect(codes(findings)).toContain("STALE_RESOLVED");
  });
});

describe("checkBindings — the stale-row rows", () => {
  it("fails a resolution row with a key whose element resolves after all", () => {
    const findings = checkBindings(
      [record()],
      law({
        register: [
          row({ value: "color.background", key: "appearance.background" }),
        ],
      }),
    );
    expect(codes(findings)).toEqual(["STALE_RESOLVED"]);
  });

  it("fails a resolution row whose element no value in the corpus consumes", () => {
    const findings = checkBindings([record()], law({ register: [row()] }));
    expect(codes(findings)).toEqual(["STALE_ORPHAN"]);
    expect(findings[0].message).toContain("no element any value in the corpus");
  });

  it("leaves a non-resolution row alone, whether its element resolves or not", () => {
    expect(
      checkBindings(
        [record()],
        law({ register: [row({ category: "X11", value: "color.text" })] }),
      ),
    ).toEqual([]);
  });
});

describe("checkBindings — the namespace check", () => {
  const namespaces: Record<string, readonly string[]> = {
    "spacing.gap": ["spacing.", "modifier.spacing.", "surface.spacing."],
    "typography.color": ["color.", "modifier.color.", "surface.color."],
  };
  const namespaceOf = (key: string) => namespaces[key];

  it("passes a channel binding, because the channel spellings are in the set", () => {
    expect(
      checkBindings(
        [
          record({
            styleKey: "typography.color",
            symbol: "modifier.color.text",
          }),
        ],
        law({ tokenNamespace: namespaceOf }),
      ),
    ).toEqual([]);
  });

  it("fails an element outside the key's set with no X8 row", () => {
    const findings = checkBindings(
      [
        record({
          styleKey: "spacing.gap",
          symbol: "dimension.100",
        }),
      ],
      law({
        symbols: symbols("dimension.100"),
        tokenNamespace: namespaceOf,
      }),
    );
    expect(codes(findings)).toEqual([NAMESPACE_CATEGORY]);
    expect(findings[0].message).toContain("spacing.");
  });

  it("passes it with an X8 row", () => {
    expect(
      checkBindings(
        [record({ styleKey: "spacing.gap", symbol: "dimension.100" })],
        law({
          symbols: symbols("dimension.100"),
          tokenNamespace: namespaceOf,
          register: [
            row({ value: "dimension.100", category: NAMESPACE_CATEGORY }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("skips the check entirely for a key with no namespace, and with no registry", () => {
    const primitive = record({ styleKey: "layout.type", symbol: "color.text" });
    expect(
      checkBindings([primitive], law({ tokenNamespace: namespaceOf })),
    ).toEqual([]);
    expect(checkBindings([primitive], law())).toEqual([]);
  });
});

describe("checkBindings — AT.11's state lint", () => {
  it("warns when a state differs from its base, naming the ranks, and exits 0", () => {
    const findings = checkBindings(
      [
        record({ symbol: "color.background" }),
        record({
          styleState: "hover",
          symbol: "color.text",
        }),
      ],
      law(),
    );
    expect(codes(findings)).toEqual(["AT11"]);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].message).toContain("rank 1");
    expect(hasFinding(findings)).toBe(false);
  });

  it("names the tree a state warning was reached through as its origin", () => {
    // The grouping the renderer does reads these fields, never the message: a
    // component that references Button carries Button's difference at its own node
    // path, and the ORIGIN is the tree that wrote the `@state` key.
    const findings = checkBindings(
      [
        record({ block: `${ds}global.component.card` }),
        record({
          block: `${ds}global.component.card`,
          styleState: "hover",
          symbol: "color.text",
        }),
      ],
      law(),
    );

    expect(findings[0].origin).toEqual({
      originBlock: `${ds}global.component.button`,
      surfacesIn: `${ds}global.component.card`,
      binding: "appearance.background@hover",
    });
  });

  it("says nothing when the state matches its base at every rank", () => {
    expect(
      checkBindings([record(), record({ styleState: "hover" })], law()),
    ).toEqual([]);
  });

  it("does not compare a state whose base carries no binding at all", () => {
    // Chip's `dismiss` child: the reference gives it a `:hover` background and no
    // unmarked one, so there is nothing to differ from.
    expect(
      checkBindings(
        [record({ node: "$root/dismiss", styleState: "hover" })],
        law(),
      ),
    ).toEqual([]);
  });

  it("warns per state, naming every rank that differs", () => {
    const findings = checkBindings(
      [
        record({ rank: 1, symbol: "modifier.color.text" }),
        record({ rank: 2, symbol: "color.text" }),
        record({ rank: 1, styleState: "disabled", symbol: "color.text" }),
        record({
          rank: 2,
          styleState: "disabled",
          symbol: "color.background",
        }),
      ],
      law(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("rank 1, 2");
  });
});

describe("checkBindings — the view invariant", () => {
  it("fails when two records share an identity, which the upsert key cannot", () => {
    const findings = checkBindings(
      [record(), record({ symbol: "color.text" })],
      law(),
    );
    expect(codes(findings)).toContain("IDENTITY");
    expect(findings[0].message).toContain("the Coda upsert key");
  });
});

describe("readBindingRecords", () => {
  it("reads back exactly what deriveTokenBindings wrote", () => {
    const store = new GraphStore();
    store.addLiteral(
      `${ds}global.component.button`,
      PREDICATES.anatomyDsl,
      "node:\n  uri: global.component.button\n  styles:\n    typography.color: [modifier.color.text, color.text]\n",
    );
    const written = deriveTokenBindings(store).records;
    const read = readBindingRecords(store);
    expect(read).toHaveLength(written.length);
    expect([...read].sort((a, b) => a.rank - b.rank)).toEqual(
      [...written].sort((a, b) => a.rank - b.rank),
    );
  });
});

describe("assertBindingsResolve", () => {
  function storeWithAnatomy(text: string): GraphStore {
    const store = new GraphStore();
    store.addLiteral(
      `${ds}global.component.button`,
      PREDICATES.anatomyDsl,
      text,
    );
    return store;
  }

  it("fails on an unresolved symbol, over the records the graph holds", () => {
    const store = storeWithAnatomy(
      "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    );
    deriveTokenBindings(store);
    const findings = assertBindingsResolve(store, law());
    expect(codes(findings)).toContain("UNRESOLVED");
    expect(hasFinding(findings)).toBe(true);
  });

  it("passes once the register admits it", () => {
    const store = storeWithAnatomy(
      "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    );
    deriveTokenBindings(store);
    expect(assertBindingsResolve(store, law({ register: [row()] }))).toEqual(
      [],
    );
  });

  it("fails on a dangling uri:, which is the derivation's own finding", () => {
    const store = storeWithAnatomy(
      'node:\n  uri: global.component.button\n  edges:\n    - node: { uri: global.component.missing }\n      relation: { cardinality: "1" }\n',
    );
    deriveTokenBindings(store);
    const findings = assertBindingsResolve(store, law());
    expect(codes(findings)).toContain("X11");
    expect(hasFinding(findings)).toBe(true);
  });

  it("checks the derived set when the graph holds no written record", () => {
    // The derivation has not been run against this store, so there is nothing written
    // to read; the law still has a record set to judge, and still refuses.
    const store = storeWithAnatomy(
      "node:\n  uri: global.component.button\n  styles:\n    appearance.background: modifier.surface\n",
    );
    expect(codes(assertBindingsResolve(store, law()))).toContain("UNRESOLVED");
  });
});

describe("RESOLUTION_CATEGORIES", () => {
  it("is exactly the five categories §5.3's invariant names", () => {
    expect(RESOLUTION_CATEGORIES).toEqual(["X1", "X2", "X5", "X7", "X15"]);
  });
});

import { describe, expect, it } from "vitest";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore } from "../graph/index.js";
import deriveTokenBindings, {
  type BindingFinding,
  childSteps,
  deriveBindingRecords,
  exitCodeFor,
  hasFinding,
  identityKey,
  readAnatomies,
  referenceIri,
  renderWarningLines,
} from "./tokenBindings.js";

const ds = NAMESPACES.ds;

/** An anatomy document as one YAML string, indented the way the literals are. */
function anatomy(lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

const BUTTON = anatomy([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    appearance.border.color: [modifier.color.border, color.border.highlighted, color.border]",
  "    layout.type: flow",
  "  edges:",
  "    - node:",
  "        uri: global.subcomponent.button_label",
  "        styles:",
  "          typography.color: [modifier.color.text, color.text]",
  '      relation: { cardinality: "1", slotName: default }',
]);

const BUTTON_LABEL = anatomy([
  "node:",
  "  uri: global.subcomponent.button_label",
  "  styles:",
  "    typography.weight: typography.weight.medium",
]);

function storeWith(anatomies: Record<string, string>): GraphStore {
  const store = new GraphStore();
  for (const [local, text] of Object.entries(anatomies)) {
    store.addLiteral(`${ds}${local}`, PREDICATES.anatomyDsl, text);
  }
  return store;
}

function derive(anatomies: Record<string, string>) {
  const store = storeWith(anatomies);
  return deriveBindingRecords(
    readAnatomies(store),
    new Set(store.getSubjects()),
  );
}

describe("referenceIri", () => {
  it("resolves a bare dotted local name against the ds namespace", () => {
    expect(referenceIri("global.component.card")).toBe(
      `${ds}global.component.card`,
    );
  });

  it("strips the ds: prefix rather than doubling the namespace", () => {
    expect(referenceIri("ds:global.component.card")).toBe(
      `${ds}global.component.card`,
    );
  });
});

describe("childSteps", () => {
  it("names a node step by its uri, and an anonymous one by its role", () => {
    const steps = childSteps({
      type: "named",
      uri: "a",
      edges: [
        {
          target: { type: "named", uri: "global.subcomponent.label" },
          relation: { cardinality: "1" },
        },
        {
          target: { type: "anonymous", role: "icon" },
          relation: { cardinality: "0..1" },
        },
      ],
    });
    expect(steps.map((step) => step.step)).toEqual([
      "global.subcomponent.label",
      "icon",
    ]);
  });

  it("appends a 1-based ordinal to every step whose name recurs among its siblings", () => {
    const steps = childSteps({
      type: "named",
      uri: "a",
      edges: [
        {
          target: { type: "anonymous", role: "icon container" },
          relation: { cardinality: "0..1", slotName: "iconLeft" },
        },
        {
          target: { type: "anonymous", role: "label text" },
          relation: { cardinality: "1" },
        },
        {
          target: { type: "anonymous", role: "icon container" },
          relation: { cardinality: "0..1", slotName: "iconRight" },
        },
      ],
    });
    expect(steps.map((step) => step.step)).toEqual([
      "icon container[1]",
      "label text",
      "icon container[2]",
    ]);
  });

  it("spells a switch case as case[<name>], so a case and a child of one name cannot collide", () => {
    const steps = childSteps({
      type: "named",
      uri: "a",
      edges: [
        {
          target: {
            discriminator: "props",
            cases: [
              { value: "h1", node: { type: "anonymous", role: "h1" } },
              { value: "h2", node: { type: "anonymous", role: "h2" } },
            ],
          },
          relation: { cardinality: "1" },
        },
      ],
    });
    expect(steps.map((step) => step.step)).toEqual(["case[h1]", "case[h2]"]);
  });
});

describe("deriveBindingRecords", () => {
  it("emits one record per symbol per rank, and none for a primitive-only value", () => {
    const { records } = derive({ "global.component.button": BUTTON });
    const root = records.filter((record) => record.node === "$root");
    expect(root.map((record) => [record.rank, record.symbol])).toEqual([
      [1, "modifier.color.border"],
      [2, "color.border.highlighted"],
      [3, "color.border"],
    ]);
    // `layout.type: flow` is a bare keyword: a primitive resolves against nothing by
    // design, so it carries no record.
    expect(records.some((record) => record.styleKey === "layout.type")).toBe(
      false,
    );
  });

  it("marks the unmarked key with the default state, because the identity is an upsert key", () => {
    const { records } = derive({ "global.component.button": BUTTON });
    expect(new Set(records.map((record) => record.styleState))).toEqual(
      new Set(["default"]),
    );
  });

  it("carries the pseudo-class state from the key's @suffix", () => {
    const spec = anatomy([
      "node:",
      "  uri: global.component.chip",
      "  styles:",
      "    appearance.background: color.foreground.secondary",
      "    appearance.background@hover: [hover.color.foreground.secondary, color.foreground.secondary.hover]",
    ]);
    const { records } = derive({ "global.component.chip": spec });
    expect(
      records.map((record) => [record.styleState, record.rank, record.symbol]),
    ).toEqual([
      ["default", 1, "color.foreground.secondary"],
      ["hover", 1, "hover.color.foreground.secondary"],
      ["hover", 2, "color.foreground.secondary.hover"],
    ]);
  });

  it("gives an own-tree record viaBlock equal to the block, so inherited is via != block", () => {
    const { records } = derive({
      "global.component.button": BUTTON,
      "global.subcomponent.button_label": BUTTON_LABEL,
    });
    const own = records.filter(
      (record) => record.block === `${ds}global.component.button`,
    );
    const inherited = own.filter((record) => record.viaBlock !== record.block);
    expect(inherited).toHaveLength(1);
    expect(inherited[0]).toMatchObject({
      viaBlock: `${ds}global.subcomponent.button_label`,
      node: "$root",
      styleKey: "typography.weight",
      symbol: "typography.weight.medium",
      rank: 1,
    });
  });

  it("restarts the referenced tree at $root, so the cross-file record is not path-prefixed", () => {
    const { records } = derive({
      "global.component.button": BUTTON,
      "global.subcomponent.button_label": BUTTON_LABEL,
    });
    // The styles THIS tree writes on the referenced child keep this tree's path…
    expect(
      records.some(
        (record) =>
          record.node === "$root/global.subcomponent.button_label" &&
          record.styleKey === "typography.color",
      ),
    ).toBe(true);
    // …and the referenced block's own tree restarts, under its own viaBlock.
    expect(
      records.some(
        (record) =>
          record.viaBlock === `${ds}global.subcomponent.button_label` &&
          record.node === "$root",
      ),
    ).toBe(true);
  });

  it("terminates on a uri: cycle and emits each identity once", () => {
    const a = anatomy([
      "node:",
      "  uri: global.component.a",
      "  styles:",
      "    typography.color: color.text",
      "  edges:",
      "    - node: { uri: global.component.b }",
      '      relation: { cardinality: "1" }',
    ]);
    const b = anatomy([
      "node:",
      "  uri: global.component.b",
      "  styles:",
      "    appearance.background: color.background",
      "  edges:",
      "    - node: { uri: global.component.a }",
      '      relation: { cardinality: "1" }',
    ]);
    const { records, findings } = derive({
      "global.component.a": a,
      "global.component.b": b,
    });
    expect(findings).toEqual([]);
    const keys = records.map(identityKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      records.filter((record) => record.block === `${ds}global.component.a`),
    ).toHaveLength(2);
  });

  it("yields one record per identity for a subcomponent referenced twice", () => {
    const parent = anatomy([
      "node:",
      "  uri: global.pattern.timeline",
      "  edges:",
      "    - node: { uri: global.subcomponent.timeline_event }",
      '      relation: { cardinality: "1", slotName: first }',
      "    - node: { uri: global.subcomponent.timeline_event }",
      '      relation: { cardinality: "1", slotName: second }',
    ]);
    const child = anatomy([
      "node:",
      "  uri: global.subcomponent.timeline_event",
      "  styles:",
      "    typography.color: color.text",
    ]);
    const { records } = derive({
      "global.pattern.timeline": parent,
      "global.subcomponent.timeline_event": child,
    });
    const inherited = records.filter(
      (record) =>
        record.block === `${ds}global.pattern.timeline` &&
        record.viaBlock !== record.block,
    );
    expect(inherited).toHaveLength(1);
  });

  it("skips $custom, which names no block to recurse into", () => {
    const spec = anatomy([
      "node:",
      "  uri: global.component.slot_holder",
      "  edges:",
      "    - node: { uri: $custom }",
      '      relation: { cardinality: "0..1", slotName: default }',
    ]);
    const { findings, records } = derive({
      "global.component.slot_holder": spec,
    });
    expect(findings).toEqual([]);
    expect(records).toEqual([]);
  });

  it("reports a dangling uri: as a finding rather than a silent zero-record block", () => {
    const spec = anatomy([
      "node:",
      "  uri: global.component.orphan",
      "  edges:",
      "    - node: { uri: global.component.copy_to_clipboard }",
      '      relation: { cardinality: "1" }',
    ]);
    const { findings } = derive({ "global.component.orphan": spec });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: "X11", severity: "finding" });
    expect(findings[0].message).toContain("global.component.copy_to_clipboard");
  });

  it("accepts a uri: whose subject exists with an empty anatomy", () => {
    const spec = anatomy([
      "node:",
      "  uri: global.component.host",
      "  edges:",
      "    - node: { uri: global.subcomponent.bare }",
      '      relation: { cardinality: "1" }',
    ]);
    const store = new GraphStore();
    store.addLiteral(`${ds}global.component.host`, PREDICATES.anatomyDsl, spec);
    store.addLiteral(
      `${ds}global.subcomponent.bare`,
      PREDICATES.anatomyDsl,
      "",
    );
    const { findings } = deriveBindingRecords(
      readAnatomies(store),
      new Set(store.getSubjects()),
    );
    expect(findings).toEqual([]);
  });

  it("skips the anatomy on a parse failure, never the block, and reports it", () => {
    const { findings, parsed, anatomies, records } = derive({
      "global.component.button": BUTTON,
      // The retired slash notation: the value grammar rejects it, so the whole
      // document fails to parse.
      "global.component.legacy": anatomy([
        "node:",
        "  uri: global.component.legacy",
        "  styles:",
        "    appearance.background: color/surface/button",
      ]),
    });
    expect(anatomies).toBe(2);
    expect(parsed).toBe(1);
    expect(records.every((record) => record.block.endsWith("button"))).toBe(
      true,
    );
    const parseFailures = findings.filter((finding) => finding.code === "X16");
    expect(parseFailures).toHaveLength(1);
    expect(parseFailures[0]).toMatchObject({
      severity: "finding",
      block: `${ds}global.component.legacy`,
    });
    expect(parseFailures[0].message).toContain("slash-delimited token path");
  });

  it("skips a referenced anatomy that does not parse, keeping the referring block's own records", () => {
    const { findings, records } = derive({
      "global.component.button": BUTTON,
      "global.subcomponent.button_label": anatomy([
        "node:",
        "  uri: global.subcomponent.button_label",
        "  styles:",
        "    typography.weight: font/weight/medium",
      ]),
    });
    // The referring block keeps its own tree's records…
    expect(
      records.filter(
        (record) =>
          record.block === `${ds}global.component.button` &&
          record.viaBlock === record.block,
      ),
    ).toHaveLength(5);
    // …and the unparseable subcomponent contributes none, with a finding naming it.
    expect(
      records.some(
        (record) => record.viaBlock === `${ds}global.subcomponent.button_label`,
      ),
    ).toBe(false);
    expect(
      findings.filter(
        (finding) =>
          finding.code === "X16" &&
          finding.block === `${ds}global.subcomponent.button_label`,
      ),
    ).toHaveLength(2);
  });

  it("emits twelve records for six full-form switch cases carrying two keys each", () => {
    const cases = ["h1", "h2", "h3", "h4", "h5", "h6"].flatMap((level) => [
      "        - node:",
      `            role: ${level}`,
      "            styles:",
      "              typography.size: typography.text.default.fontSize",
      "              spacing.margin.bottom: spacing.small",
    ]);
    const heading = anatomy([
      "node:",
      "  uri: global.component.heading",
      "  edges:",
      "    - switch:",
      "        on: props",
      "        cases:",
      ...cases,
      '      relation: { cardinality: "1" }',
    ]);
    const { records } = derive({ "global.component.heading": heading });
    expect(records).toHaveLength(12);
    expect(new Set(records.map((record) => record.node))).toEqual(
      new Set([
        "$root/case[h1]",
        "$root/case[h2]",
        "$root/case[h3]",
        "$root/case[h4]",
        "$root/case[h5]",
        "$root/case[h6]",
      ]),
    );
  });

  it("tells three identically-bound link nodes apart by their path, which a role cannot", () => {
    const link = [
      "role: link",
      "styles:",
      "  typography.color: color.text.link",
    ];
    const toc = anatomy([
      "node:",
      "  uri: global.pattern.table_of_contents",
      "  edges:",
      "    - node:",
      "        role: nav list",
      "        edges:",
      "          - node:",
      "              role: level-1 entry",
      "              edges:",
      `                - node: { ${link[0]}, ${link[1]} { typography.color: color.text.link } }`,
      '                  relation: { cardinality: "1" }',
      "                - node:",
      "                    role: level-2 entry",
      "                    edges:",
      `                      - node: { ${link[0]}, ${link[1]} { typography.color: color.text.link } }`,
      '                        relation: { cardinality: "1" }',
      "                      - node:",
      "                          role: level-3 entry",
      "                          edges:",
      `                            - node: { ${link[0]}, ${link[1]} { typography.color: color.text.link } }`,
      '                              relation: { cardinality: "1" }',
      '                        relation: { cardinality: "0..*" }',
      '                  relation: { cardinality: "0..*" }',
      '            relation: { cardinality: "1..*" }',
      '      relation: { cardinality: "1", slotName: default }',
    ]);
    const { records } = derive({ "global.pattern.table_of_contents": toc });
    expect(new Set(records.map((record) => record.node))).toEqual(
      new Set([
        "$root/nav list/level-1 entry/link",
        "$root/nav list/level-1 entry/level-2 entry/link",
        "$root/nav list/level-1 entry/level-2 entry/level-3 entry/link",
      ]),
    );
    // Three distinct identities from three identical bindings — the collision the
    // path exists to resolve.
    expect(new Set(records.map(identityKey)).size).toBe(3);
  });
});

describe("hasFinding and exitCodeFor", () => {
  it("treats a warning as printable and not as a failure", () => {
    const warnings = [
      { code: "AT11", severity: "warning" as const, message: "differs" },
    ];
    expect(hasFinding(warnings)).toBe(false);
    expect(exitCodeFor(warnings)).toBe(0);
  });

  it("treats one finding among warnings as a failure", () => {
    const mixed = [
      { code: "AT11", severity: "warning" as const, message: "differs" },
      { code: "X11", severity: "finding" as const, message: "dangling" },
    ];
    expect(hasFinding(mixed)).toBe(true);
    expect(exitCodeFor(mixed)).toBe(1);
  });
});

describe("deriveTokenBindings", () => {
  it("writes eight quads per record as a blank node hung off the block", () => {
    const store = storeWith({ "global.component.button": BUTTON });
    const before = store.size();
    const result = deriveTokenBindings(store);
    expect(result.records).toHaveLength(5);
    expect(store.size() - before).toBe(result.records.length * 8);
  });

  it("puts the record in the block's own per-instance closure", () => {
    const store = storeWith({ "global.component.button": BUTTON });
    deriveTokenBindings(store);
    const closure = store.getQuadsForSubject(`${ds}global.component.button`);
    const symbols = closure
      .filter((entry) => entry.predicate.value === PREDICATES.consumesSymbol)
      .map((entry) => entry.object.value);
    expect(symbols).toContain(`${NAMESPACES.dt}modifier.color.border`);
  });

  it("writes rank as an xsd:integer, which is what a numeric query reads", () => {
    const store = storeWith({ "global.component.button": BUTTON });
    deriveTokenBindings(store);
    const ranks = store
      .getQuads()
      .filter((entry) => entry.predicate.value === PREDICATES.rank);
    expect(ranks).toHaveLength(5);
    for (const entry of ranks) {
      expect(entry.object.termType).toBe("Literal");
      expect(
        (entry.object as { datatype: { value: string } }).datatype.value,
      ).toBe(`${NAMESPACES.xsd}integer`);
    }
  });

  it("leaves the store alone when no block carries an anatomy", () => {
    const store = new GraphStore();
    store.addLiteral(`${ds}global.component.bare`, PREDICATES.name, "Bare");
    const before = store.size();
    const result = deriveTokenBindings(store);
    expect(result).toMatchObject({ anatomies: 0, parsed: 0, records: [] });
    expect(store.size()).toBe(before);
  });

  it("ignores an empty anatomy literal and a blank-node subject", () => {
    const store = storeWith({ "global.component.button": BUTTON });
    store.addLiteral(
      `${ds}global.component.empty`,
      PREDICATES.anatomyDsl,
      "   ",
    );
    const node = store.createBlankNode();
    store.addBlankNodeQuad(
      `${ds}global.component.button`,
      PREDICATES.name,
      node,
    );
    store.addLiteralFromBlankNode(node, PREDICATES.anatomyDsl, BUTTON);
    expect(deriveTokenBindings(store).anatomies).toBe(1);
  });
});

describe("renderWarningLines", () => {
  /** One AT11 warning, as `stateDifferences` emits it. */
  const at11 = (
    originBlock: string,
    surfacesIn: string,
    binding: string,
  ): BindingFinding => ({
    code: "AT11",
    severity: "warning",
    message: `${surfacesIn} $root ${binding} differs from its base state at rank 1`,
    block: surfacesIn,
    origin: { originBlock, surfacesIn, binding },
  });

  it("says one origin's differences once, however many places they surface in", () => {
    // Button's two differing bindings, at Button and at the two anatomies that
    // reference it: six warnings, and one thing to tell someone.
    const lines = renderWarningLines([
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.button`,
        "appearance.background@hover",
      ),
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.button`,
        "typography.color@disabled",
      ),
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.card`,
        "appearance.background@hover",
      ),
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.card`,
        "typography.color@disabled",
      ),
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.tile`,
        "appearance.background@hover",
      ),
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.tile`,
        "typography.color@disabled",
      ),
    ]);

    expect(lines).toEqual([
      "  ⚠ AT11 global.component.button: 2 state bindings differ from their base state (appearance.background@hover, typography.color@disabled), surfacing in 3 anatomies through references",
    ]);
  });

  it("keeps two origins apart and orders them by name", () => {
    const lines = renderWarningLines([
      at11(
        `${ds}global.component.tag`,
        `${ds}global.component.tag`,
        "appearance.background@hover",
      ),
      at11(
        `${ds}global.component.button`,
        `${ds}global.component.button`,
        "appearance.background@hover",
      ),
    ]);

    // One binding and one anatomy each, said in the singular, and Button first.
    expect(lines).toEqual([
      "  ⚠ AT11 global.component.button: 1 state binding differs from its base state (appearance.background@hover), surfacing in its own anatomy alone",
      "  ⚠ AT11 global.component.tag: 1 state binding differs from its base state (appearance.background@hover), surfacing in its own anatomy alone",
    ]);
  });

  it("prints a warning that is not the state lint, and one carrying no origin, verbatim", () => {
    const lines = renderWarningLines([
      {
        code: "TTL_PARSE",
        severity: "warning",
        message: "global.ttl is not parseable Turtle",
      },
      {
        code: "AT11",
        severity: "warning",
        message: "a state lint with no origin field",
      },
      {
        code: "X11",
        severity: "finding",
        message: "a finding is never grouped, and never a warning line",
      },
    ]);

    expect(lines).toEqual([
      "  ⚠ TTL_PARSE global.ttl is not parseable Turtle",
      "  ⚠ AT11 a state lint with no origin field",
    ]);
  });
});

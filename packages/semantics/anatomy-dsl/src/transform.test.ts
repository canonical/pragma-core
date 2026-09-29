import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectTypeOf } from "expect-type";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { parseAnatomyYAML } from "./parse.js";
import { anatomyToTTL } from "./transform.js";
import type {
  AnonymousNode,
  Edge,
  NamedNode,
  Node,
  Projection,
  Relation,
  Specification,
  Switch,
} from "./types.js";

const EXAMPLES_DIR = resolve(import.meta.dirname, "../examples");

function loadCase(name: string): { yaml: string; ttl: string } {
  return {
    yaml: readFileSync(
      resolve(EXAMPLES_DIR, `yaml/${name}.anatomy.yaml`),
      "utf8",
    ),
    ttl: readFileSync(resolve(EXAMPLES_DIR, `turtle/${name}.ttl`), "utf8"),
  };
}

function roundTrip(name: string): void {
  const { yaml, ttl } = loadCase(name);
  const parsed = parse(yaml);
  const spec = parseAnatomyYAML(parsed);
  const result = anatomyToTTL(spec);
  expect(result.trimEnd()).toBe(ttl.trimEnd());
}

describe("anatomyToTTL", () => {
  it("accordion — nested named nodes, styles, mixed relations", () => {
    roundTrip("accordion");
  });

  it("card — multiple edges, anonymous node, nested edges", () => {
    roundTrip("card");
  });

  it("field — switch with on:props, URI-shorthand cases", () => {
    roundTrip("field");
  });

  it("async-button — switch with on:internal, 4 cases", () => {
    roundTrip("async-button");
  });

  it("timeline — switch with on:override, $custom URI", () => {
    roundTrip("timeline");
  });

  it("input-group — switch with mixed cases (shorthand + full node)", () => {
    roundTrip("input-group");
  });

  it("entity-card — projections on nodes, relations, and switch cases", () => {
    roundTrip("entity-card");
  });

  it("status-header — pinned props: intrinsic icons, status switch, unpinned slot", () => {
    roundTrip("status-header");
  });

  it("stateful-button — @state style keys across default/hover/active/focus/disabled", () => {
    roundTrip("stateful-button");
  });
});

describe("the seam", () => {
  it("emits consumes as an rdf:List in fallback order, beside the spelling", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.button",
        styles: [
          {
            key: "typography.color",
            value: "[modifier.color.text, color.text]",
            symbols: ["modifier.color.text", "color.text"],
          },
        ],
      },
    });
    expect(ttl).toContain("@prefix dt: <https://dt.canonical.com/> .");
    expect(ttl).toContain(
      ':styleValue "[modifier.color.text, color.text]" ; :consumes ( dt:modifier.color.text dt:color.text )',
    );
  });

  it("keeps the terminal literal in the value and out of the list", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.button",
        styles: [
          {
            key: "appearance.outline.color",
            value: "[modifier.color.focusRing, currentColor]",
            symbols: ["modifier.color.focusRing"],
          },
        ],
      },
    });
    expect(ttl).toContain(
      ':styleValue "[modifier.color.focusRing, currentColor]" ; :consumes ( dt:modifier.color.focusRing )',
    );
  });

  it("emits none for a primitive key, and none for a primitive value", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.button",
        styles: [
          // A primitive key: the registry admits no symbol on it at all.
          { key: "layout.type", value: "flow", symbols: [] },
          // An either key carrying a primitive: there is no symbol to consume.
          { key: "appearance.background", value: "transparent", symbols: [] },
        ],
      },
    });
    expect(ttl).not.toContain(":consumes");
  });
});

describe("interaction states", () => {
  it("parse splits the @state marker off the style key", () => {
    const spec = parseAnatomyYAML({
      node: {
        uri: "global.component.button",
        styles: {
          "appearance.background": "color.foreground.primary",
          "appearance.background@hover": "color.foreground.primary.hover",
        },
      },
    });
    expect(spec.root.styles).toEqual([
      {
        key: "appearance.background",
        value: "color.foreground.primary",
        symbols: ["color.foreground.primary"],
      },
      {
        key: "appearance.background",
        value: "color.foreground.primary.hover",
        symbols: ["color.foreground.primary.hover"],
        state: "hover",
      },
    ]);
  });

  it("parses every state the closed vocabulary admits", () => {
    // The closed set is the shapes' to enforce; this is the parser's half —
    // each marker is split off the key and carried verbatim, the three
    // additions included.
    const states = [
      "hover",
      "active",
      "focus",
      "disabled",
      "selected",
      "expanded",
      "indeterminate",
      "invalid",
    ];
    for (const state of states) {
      const spec = parseAnatomyYAML({
        node: {
          uri: "global.component.accordion",
          styles: { [`appearance.background@${state}`]: "color.surface" },
        },
      });
      expect(spec.root.styles, state).toEqual([
        {
          key: "appearance.background",
          value: "color.surface",
          symbols: ["color.surface"],
          state,
        },
      ]);
    }
  });

  it("emits styleState between key and value", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.button",
        styles: [
          {
            key: "appearance.outline.color",
            value: "color.focusRing",
            symbols: ["color.focusRing"],
            state: "focus",
          },
        ],
      },
    });
    expect(ttl).toContain(
      '[ a :Style ; :styleKey "appearance.outline.color" ; :styleState "focus" ; :styleValue "color.focusRing" ; :consumes ( dt:color.focusRing ) ]',
    );
  });

  it("parse rejects @default", () => {
    expect(() =>
      parseAnatomyYAML({
        node: {
          uri: "global.component.button",
          styles: { "appearance.background@default": "color/fill/default" },
        },
      }),
    ).toThrow('drop "@default"');
  });

  it("parse rejects compound states for now", () => {
    expect(() =>
      parseAnatomyYAML({
        node: {
          uri: "global.component.button",
          styles: {
            "appearance.background@selected@hover": "color/fill/selected/hover",
          },
        },
      }),
    ).toThrow("Compound states are not yet supported");
  });

  it("parse rejects an empty state", () => {
    expect(() =>
      parseAnatomyYAML({
        node: {
          uri: "global.component.button",
          styles: { "appearance.background@": "color/fill/default" },
        },
      }),
    ).toThrow("empty state");
  });
});

describe("props", () => {
  it("props-only node closes the blank node", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.icon",
        props: [{ name: "icon", value: "close" }],
      },
    });
    expect(ttl).toContain(":hasProp\n");
    expect(ttl).toContain(
      '[ a :Prop ; :propName "icon" ; :propValue "close" ]\n',
    );
    expect(ttl).not.toContain('"close" ] ;');
  });

  it("props followed by styles carries a separator", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.icon",
        props: [{ name: "icon", value: "close" }],
        styles: [{ key: "layout.type", value: "inline-block", symbols: [] }],
      },
    });
    expect(ttl).toContain(
      '[ a :Prop ; :propName "icon" ; :propValue "close" ] ;',
    );
  });

  it("parse coerces scalar pins to strings", () => {
    const spec = parseAnatomyYAML({
      node: { uri: "global.component.icon", props: { truncate: true, max: 3 } },
    });
    expect(spec.root.props).toEqual([
      { name: "truncate", value: "true" },
      { name: "max", value: "3" },
    ]);
  });

  it("parse rejects props on an anonymous node", () => {
    expect(() =>
      parseAnatomyYAML({
        node: {
          uri: "global.component.card",
          edges: [
            {
              node: { role: "icon holder", props: { icon: "close" } },
              relation: { cardinality: "1" },
            },
          ],
        },
      }),
    ).toThrow("Props are only allowed on named nodes");
  });
});

describe("projections", () => {
  it("node projection without styles or edges closes the blank node", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.chip",
        projection: { field: "_meta.title" },
      },
    });
    expect(ttl).toContain(
      ':hasProjection [ a :Projection ; :projectionField "_meta.title" ]\n',
    );
    expect(ttl).not.toContain('"_meta.title" ] ;');
  });

  it("node projection followed by styles carries a separator", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.chip",
        projection: { on: "Component" },
        styles: [{ key: "layout.type", value: "flow", symbols: [] }],
      },
    });
    expect(ttl).toContain(
      ':hasProjection [ a :Projection ; :projectionType "Component" ] ;',
    );
  });

  it("relation projection emits inside the relation, without slotName", () => {
    const ttl = anatomyToTTL({
      root: {
        type: "named",
        uri: "global.component.list",
        edges: [
          {
            target: { type: "anonymous", role: "item row" },
            relation: {
              cardinality: "0..*",
              projection: { field: "properties" },
            },
          },
        ],
      },
    });
    expect(ttl).toContain(':cardinality "0..*" ;');
    expect(ttl).toContain(
      ':hasProjection [ a :Projection ; :projectionField "properties" ]',
    );
  });

  it("parse rejects an empty projection", () => {
    expect(() =>
      parseAnatomyYAML({
        node: { uri: "global.component.chip", projection: {} },
      }),
    ).toThrow("Projection must have at least one of on, field");
  });

  it("parse rejects a relation projection without a field", () => {
    expect(() =>
      parseAnatomyYAML({
        node: {
          uri: "global.component.list",
          edges: [
            {
              node: { role: "item row" },
              relation: { cardinality: "0..*", projection: {} },
            },
          ],
        },
      }),
    ).toThrow("Relation projection requires a field");
  });
});

describe("type compilation checks", () => {
  it("Node discriminated union narrows on type field", () => {
    const node: Node = { type: "named", uri: "test" } as Node;
    if (node.type === "named") {
      expectTypeOf(node).toMatchTypeOf<NamedNode>();
    } else {
      expectTypeOf(node).toMatchTypeOf<AnonymousNode>();
    }
  });

  it("Edge.target narrows to Node or Switch", () => {
    const edge: Edge = {
      target: { type: "named", uri: "test" },
      relation: { cardinality: "1" },
    };
    if ("discriminator" in edge.target) {
      expectTypeOf(edge.target).toMatchTypeOf<Switch>();
    } else {
      expectTypeOf(edge.target).toMatchTypeOf<Node>();
    }
  });

  it("Specification.root is NamedNode", () => {
    expectTypeOf<Specification["root"]>().toEqualTypeOf<NamedNode>();
  });

  it("Projection requires at least one of on/field", () => {
    // @ts-expect-error — an empty projection is unrepresentable
    const empty: Projection = {};
    void empty;
    expectTypeOf<{ on: string }>().toMatchTypeOf<Projection>();
    expectTypeOf<{ field: string }>().toMatchTypeOf<Projection>();
    expectTypeOf<{ on: string; field: string }>().toMatchTypeOf<Projection>();
  });

  it("Relation projection requires a field and admits no type condition", () => {
    expectTypeOf<NonNullable<Relation["projection"]>>().toEqualTypeOf<{
      field: string;
    }>();
  });

  it("props exist on NamedNode only", () => {
    expectTypeOf<NamedNode>().toHaveProperty("props");
    const anon: AnonymousNode = {
      type: "anonymous",
      role: "wrapper",
      // @ts-expect-error — anonymous nodes have no prop surface to pin
      props: [{ name: "icon", value: "close" }],
    };
    void anon;
  });
});

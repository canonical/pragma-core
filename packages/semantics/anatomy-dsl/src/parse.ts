import AnatomyKeyError from "./AnatomyKeyError.js";
import { parseAnatomyDocument } from "./document/index.js";
import type {
  Edge,
  NamedNode,
  Node,
  Projection,
  Prop,
  Relation,
  RelationProjection,
  Specification,
  Style,
  Switch,
  SwitchCase,
} from "./types.js";
import { authoredSpelling, liftSymbols } from "./value.js";

/**
 * The one lift every consumer shares. It is implemented in `./value.js`,
 * beside the grammar it belongs to, and re-exported here because the parser
 * is where a reader looks for it.
 */
export { liftSymbols } from "./value.js";

/** The steps from the document root to a mapping. */
type Path = (string | number)[];

/**
 * The keys each kind of mapping takes. Every mapping is closed: a key outside
 * its kind's set is rejected rather than dropped, because a dropped key is a
 * subtree, a style or a pin that silently goes missing from the graph.
 */
const ROOT_KEYS = ["node"] as const;
const NAMED_NODE_KEYS = [
  "uri",
  "projection",
  "props",
  "styles",
  "edges",
] as const;
const ANONYMOUS_NODE_KEYS = ["role", "projection", "styles", "edges"] as const;
const EDGE_TARGETS = ["node", "uri", "switch"] as const;
const EDGE_KEYS = [...EDGE_TARGETS, "relation"] as const;
const SWITCH_KEYS = ["on", "cases"] as const;
const DISCRIMINATORS: readonly string[] = ["props", "internal", "override"];
const CASE_KEYS = ["uri", "node"] as const;
const RELATION_KEYS = ["cardinality", "slotName", "projection"] as const;
const NODE_PROJECTION_KEYS = ["on", "field"] as const;
const RELATION_PROJECTION_KEYS = ["field"] as const;

/** Rules for a known key in the wrong place, worded for the repair. */
const MISPLACED: Record<string, Record<string, string>> = {
  root: {
    role: "the root node is named: give it a `uri`, not a `role`",
  },
  edge: {
    edges:
      "an edge takes no `edges` — it belongs inside the edge's `node:` mapping",
  },
  anonymous: {
    props:
      "Props are only allowed on named nodes — an anonymous node has no prop surface to pin",
  },
};

/** True for a YAML mapping, as the parsed document holds one. */
function isMapping(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw);
}

/** True for a key that holds a value: an empty one (`props:`) reads as absent. */
function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/** The shape a key's value must have. */
type Shape = "mapping" | "sequence" | "string";

/** How a rule names each shape, and how a value is tested for it. */
const SHAPE_RULES: Record<
  Shape,
  { name: string; test: (raw: unknown) => boolean }
> = {
  mapping: { name: "a mapping", test: isMapping },
  sequence: { name: "a sequence", test: Array.isArray },
  string: {
    name: "a non-empty string",
    test: (raw) => typeof raw === "string" && raw !== "",
  },
};

/**
 * The value shape of each structural key. A sequence where a mapping belongs
 * would otherwise be read by its indices (`props: [x, y]` as pins named `0`
 * and `1`), a scalar by its characters, and a number or a mapping where a
 * name belongs would be carried as it stands.
 */
const SHAPES: Record<string, Shape> = {
  node: "mapping",
  projection: "mapping",
  props: "mapping",
  styles: "mapping",
  edges: "sequence",
  switch: "mapping",
  relation: "mapping",
  cases: "sequence",
  uri: "string",
  role: "string",
  slotName: "string",
  on: "string",
  field: "string",
};

/**
 * Reject a key the mapping's kind does not take, and a structural key whose
 * value has the wrong shape. A key with no value reads as absent, whether or
 * not the mapping takes it, so the rule that requires the key reports it.
 */
function assertKeys(
  raw: Record<string, unknown>,
  allowed: readonly string[],
  path: Path,
  misplaced: Record<string, string> = {},
): void {
  for (const [key, value] of Object.entries(raw)) {
    if (!isPresent(value)) continue;
    if (!allowed.includes(key)) {
      throw new AnatomyKeyError(
        key,
        path,
        allowed,
        misplaced[key] ??
          `not a key of this mapping, which takes ${allowed.map((name) => `\`${name}\``).join(", ")}`,
      );
    }
    const shape = SHAPES[key];
    if (shape === undefined) continue;
    const rule = SHAPE_RULES[shape];
    if (!rule.test(value)) {
      throw new AnatomyKeyError(
        key,
        path,
        allowed,
        `\`${key}\` takes ${rule.name}`,
      );
    }
  }
}

/**
 * Parse an anatomy document.
 *
 * Give it the YAML text — which is what design-system holds, one
 * `ds:anatomyDsl` literal per block — and it is parsed here, with
 * `parseAnatomyDocument`, which throws an `AnatomySyntaxError` on text that
 * is not well-formed YAML. An already-parsed value is still accepted, for a
 * caller that has one.
 *
 * Every mapping is closed, and a document that breaks a rule about its keys
 * throws an `AnatomyKeyError`; the error's own documentation lists the rules.
 */
export function parseAnatomyYAML(raw: string | unknown): Specification {
  const doc = typeof raw === "string" ? parseAnatomyDocument(raw).toJS() : raw;
  if (!isMapping(doc)) {
    throw new Error("An anatomy document is a mapping with one `node` key");
  }
  assertKeys(doc, ROOT_KEYS, []);
  if (!isPresent(doc.node)) {
    throw new AnatomyKeyError(
      "node",
      [],
      ROOT_KEYS,
      "An anatomy document is a mapping with one `node` key",
    );
  }
  return {
    root: toNamedNode(
      doc.node as Record<string, unknown>,
      ["node"],
      MISPLACED.root,
    ),
  };
}

/** The edges of a node, each with its own path. */
function toEdges(raw: unknown, path: Path): Edge[] {
  return (raw as unknown[]).map((edge, index) =>
    toEdge(edge, [...path, "edges", index]),
  );
}

function toNamedNode(
  raw: Record<string, unknown>,
  path: Path,
  misplaced: Record<string, string> = {},
): NamedNode {
  assertKeys(raw, NAMED_NODE_KEYS, path, misplaced);
  if (!isPresent(raw.uri)) {
    throw new AnatomyKeyError(
      "uri",
      path,
      NAMED_NODE_KEYS,
      "a named node needs its `uri`",
    );
  }
  return {
    type: "named",
    uri: raw.uri as string,
    ...(isPresent(raw.projection)
      ? { projection: toProjection(raw.projection, [...path, "projection"]) }
      : {}),
    ...(isPresent(raw.props)
      ? { props: toProps(raw.props, [...path, "props"]) }
      : {}),
    ...(isPresent(raw.styles)
      ? {
          styles: toStyles(raw.styles as Record<string, unknown>, [
            ...path,
            "styles",
          ]),
        }
      : {}),
    ...(isPresent(raw.edges) ? { edges: toEdges(raw.edges, path) } : {}),
  };
}

/** A node: named when it carries a `uri`, anonymous when it carries a `role`. */
function toNode(raw: Record<string, unknown>, path: Path): Node {
  if (isPresent(raw.uri)) {
    return toNamedNode(raw, path);
  }
  assertKeys(raw, ANONYMOUS_NODE_KEYS, path, MISPLACED.anonymous);
  if (!isPresent(raw.role)) {
    throw new AnatomyKeyError(
      "role",
      path,
      ANONYMOUS_NODE_KEYS,
      "an anonymous node needs its `role`, or a `uri` to be named",
    );
  }
  return {
    type: "anonymous",
    role: raw.role as string,
    ...(isPresent(raw.projection)
      ? { projection: toProjection(raw.projection, [...path, "projection"]) }
      : {}),
    ...(isPresent(raw.styles)
      ? {
          styles: toStyles(raw.styles as Record<string, unknown>, [
            ...path,
            "styles",
          ]),
        }
      : {}),
    ...(isPresent(raw.edges) ? { edges: toEdges(raw.edges, path) } : {}),
  };
}

function toProjection(raw: unknown, path: Path): Projection {
  const projection = raw as Record<string, unknown>;
  assertKeys(projection, NODE_PROJECTION_KEYS, path);
  const on = projection.on as string | undefined | null;
  const field = projection.field as string | undefined | null;
  if (!isPresent(on) && !isPresent(field)) {
    throw new AnatomyKeyError(
      "on",
      path,
      NODE_PROJECTION_KEYS,
      "a projection needs `on`, `field` or both",
    );
  }
  return {
    ...(isPresent(on) ? { on } : {}),
    ...(isPresent(field) ? { field } : {}),
  } as Projection;
}

function toStyles(raw: Record<string, unknown>, path: Path): Style[] {
  // A style mapping is open: the roster, not the parser, closes its keys, so
  // a rejected marker names the keys present as the ones the mapping holds.
  const reject = (rawKey: string, rule: string): never => {
    throw new AnatomyKeyError(rawKey, path, Object.keys(raw), rule);
  };
  return Object.entries(raw).map(([rawKey, value]) => {
    const [key, state, ...rest] = rawKey.split("@");
    if (rest.length > 0) {
      reject(rawKey, "Compound states are not yet supported — one `@` per key");
    }
    if (state === "") {
      reject(rawKey, "Style key has an empty state — name it, or drop the `@`");
    }
    if (state === "default") {
      reject(rawKey, 'The unmarked key is the default state — drop "@default"');
    }
    return {
      key: key as string,
      // The authored spelling is kept verbatim as evidence; the symbols are
      // lifted from it by the one lift every consumer shares (§4.1).
      value: authoredSpelling(value),
      symbols: liftSymbols(value, key),
      ...(state !== undefined ? { state } : {}),
    };
  });
}

function toProps(raw: unknown, path: Path): Prop[] {
  const pins = raw as Record<string, unknown>;
  return Object.entries(pins).map(([name, value]) => {
    // A pin is one value. An empty one would be stored as "null", and a
    // mapping or a sequence as "[object Object]": neither pins anything
    // anyone wrote.
    if (!isPresent(value)) {
      throw new AnatomyKeyError(
        name,
        path,
        Object.keys(pins),
        "a pin needs a value",
      );
    }
    if (typeof value === "object") {
      throw new AnatomyKeyError(
        name,
        path,
        Object.keys(pins),
        "a pin's value is a scalar, never a mapping or a sequence",
      );
    }
    return { name, value: String(value) };
  });
}

function toEdge(raw: unknown, path: Path): Edge {
  if (!isMapping(raw)) {
    throw new AnatomyKeyError(
      "node",
      path,
      EDGE_KEYS,
      "an edge is a mapping with one target: `node`, `uri` or `switch`",
    );
  }
  assertKeys(raw, EDGE_KEYS, path, MISPLACED.edge);
  // Exactly one target: taking the first and dropping the others would lose
  // a subtree without a word.
  const targets = EDGE_TARGETS.filter((key) => isPresent(raw[key]));
  if (targets.length > 1) {
    throw new AnatomyKeyError(
      targets.at(1) as string,
      path,
      EDGE_KEYS,
      `an edge has exactly one target, and this one has ${targets.map((key) => `\`${key}\``).join(" and ")}`,
    );
  }
  const target = targets.at(0);
  if (target === undefined) {
    throw new AnatomyKeyError(
      "node",
      path,
      EDGE_KEYS,
      "an edge needs one target: `node`, `uri` or `switch`",
    );
  }
  if (!isPresent(raw.relation)) {
    throw new AnatomyKeyError(
      "relation",
      path,
      EDGE_KEYS,
      "an edge needs a `relation` mapping, with its `cardinality`",
    );
  }
  return {
    target:
      target === "switch"
        ? toSwitch(raw.switch as Record<string, unknown>, [...path, "switch"])
        : target === "node"
          ? toNode(raw.node as Record<string, unknown>, [...path, "node"])
          : { type: "named", uri: raw.uri as string },
    relation: toRelation(raw.relation as Record<string, unknown>, [
      ...path,
      "relation",
    ]),
  };
}

function toSwitch(raw: Record<string, unknown>, path: Path): Switch {
  assertKeys(raw, SWITCH_KEYS, path);
  if (!DISCRIMINATORS.includes(raw.on as string)) {
    throw new AnatomyKeyError(
      "on",
      path,
      SWITCH_KEYS,
      `a switch is \`on\` one of ${DISCRIMINATORS.map((name) => `\`${name}\``).join(", ")}`,
    );
  }
  const cases = ((raw.cases ?? []) as unknown[]).map((switchCase, index) =>
    toSwitchCase(switchCase, [...path, "cases", index]),
  );
  // Checked after the cases themselves, so a broken case is named as such.
  if (cases.length < 2) {
    throw new AnatomyKeyError(
      "cases",
      path,
      SWITCH_KEYS,
      "a switch needs at least two `cases` — one alternative is a node",
    );
  }
  return {
    discriminator: raw.on as Switch["discriminator"],
    cases,
  };
}

function toSwitchCase(raw: unknown, path: Path): SwitchCase {
  if (isMapping(raw)) assertKeys(raw, CASE_KEYS, path);
  const hasUri = isMapping(raw) && isPresent(raw.uri);
  const hasNode = isMapping(raw) && isPresent(raw.node);
  if (!isMapping(raw) || (!hasUri && !hasNode)) {
    throw new AnatomyKeyError(
      "uri",
      path,
      CASE_KEYS,
      "a switch case has `uri` or `node`",
    );
  }
  if (hasUri && hasNode) {
    throw new AnatomyKeyError(
      "node",
      path,
      CASE_KEYS,
      "a switch case has `uri` or `node`, never both",
    );
  }
  if (hasUri) {
    const uri = raw.uri as string;
    return { value: uri, node: { type: "named", uri } };
  }
  const node = toNode(raw.node as Record<string, unknown>, [...path, "node"]);
  const value = node.type === "named" ? node.uri : node.role;
  return { value, node };
}

function toRelation(raw: Record<string, unknown>, path: Path): Relation {
  assertKeys(raw, RELATION_KEYS, path);
  if (typeof raw.cardinality !== "string" || raw.cardinality === "") {
    throw new AnatomyKeyError(
      "cardinality",
      path,
      RELATION_KEYS,
      'a relation needs its `cardinality`, quoted (`"1"`, `"0..*"`)',
    );
  }
  return {
    cardinality: raw.cardinality,
    ...(isPresent(raw.slotName) ? { slotName: raw.slotName as string } : {}),
    ...(isPresent(raw.projection)
      ? {
          projection: toRelationProjection(
            raw.projection as Record<string, unknown>,
            [...path, "projection"],
          ),
        }
      : {}),
  };
}

function toRelationProjection(
  raw: Record<string, unknown>,
  path: Path,
): RelationProjection {
  assertKeys(raw, RELATION_PROJECTION_KEYS, path);
  if (!isPresent(raw.field)) {
    throw new AnatomyKeyError(
      "field",
      path,
      RELATION_PROJECTION_KEYS,
      "a relation projection needs its `field`",
    );
  }
  return { field: raw.field as string };
}

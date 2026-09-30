import { parseAnatomyDocument } from "./document/index.js";
import type {
  Edge,
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

interface RawYaml {
  node: RawNamedNode;
}

interface RawNamedNode {
  uri: string;
  projection?: RawProjection;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  edges?: RawEdge[];
}

interface RawAnonymousNode {
  role: string;
  projection?: RawProjection;
  styles?: Record<string, unknown>;
  edges?: RawEdge[];
}

interface RawProjection {
  on?: string;
  field?: string;
}

type RawNode = RawNamedNode | RawAnonymousNode;

interface RawEdge {
  node?: RawNode;
  uri?: string;
  switch?: RawSwitch;
  relation: RawRelation;
}

interface RawSwitch {
  on: "props" | "internal" | "override";
  cases: RawSwitchCase[];
}

type RawSwitchCase =
  | { uri: string; node?: never }
  | { node: RawNode; uri?: never };

interface RawRelation {
  cardinality: string;
  slotName?: string;
  projection?: { field: string };
}

/**
 * Parse an anatomy document.
 *
 * Give it the YAML text — which is what design-system holds, one
 * `ds:anatomyDsl` literal per block — and it is parsed here, with
 * `parseAnatomyDocument`, which throws an `AnatomySyntaxError` on text that
 * is not well-formed YAML. An already-parsed value is still accepted, for a
 * caller that has one.
 */
export function parseAnatomyYAML(raw: string | unknown): Specification {
  const doc = (
    typeof raw === "string" ? parseAnatomyDocument(raw).toJS() : raw
  ) as RawYaml;
  if (doc === null || typeof doc !== "object" || doc.node === undefined) {
    throw new Error("An anatomy document is a mapping with one `node` key");
  }
  return {
    root: toNamedNode(doc.node),
  };
}

function toNamedNode(raw: RawNamedNode): Node & { type: "named" } {
  return {
    type: "named",
    uri: raw.uri,
    ...(raw.projection ? { projection: toProjection(raw.projection) } : {}),
    ...(raw.props ? { props: toProps(raw.props) } : {}),
    ...(raw.styles ? { styles: toStyles(raw.styles) } : {}),
    ...(raw.edges ? { edges: raw.edges.map(toEdge) } : {}),
  };
}

function toNode(raw: RawNode): Node {
  if ("uri" in raw && raw.uri) {
    return toNamedNode(raw as RawNamedNode);
  }
  if ("props" in raw) {
    throw new Error("Props are only allowed on named nodes");
  }
  const anon = raw as RawAnonymousNode;
  return {
    type: "anonymous",
    role: anon.role,
    ...(anon.projection ? { projection: toProjection(anon.projection) } : {}),
    ...(anon.styles ? { styles: toStyles(anon.styles) } : {}),
    ...(anon.edges ? { edges: anon.edges.map(toEdge) } : {}),
  };
}

function toProjection(raw: RawProjection): Projection {
  if (raw.on === undefined && raw.field === undefined) {
    throw new Error("Projection must have at least one of on, field");
  }
  return {
    ...(raw.on !== undefined ? { on: raw.on } : {}),
    ...(raw.field !== undefined ? { field: raw.field } : {}),
  } as Projection;
}

function toStyles(raw: Record<string, unknown>): Style[] {
  return Object.entries(raw).map(([rawKey, value]) => {
    const [key, state, ...rest] = rawKey.split("@");
    if (rest.length > 0) {
      throw new Error(`Compound states are not yet supported: ${rawKey}`);
    }
    if (state === "") {
      throw new Error(`Style key has an empty state: ${rawKey}`);
    }
    if (state === "default") {
      throw new Error(
        `The unmarked key is the default state — drop "@default": ${rawKey}`,
      );
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

function toProps(raw: Record<string, unknown>): Prop[] {
  return Object.entries(raw).map(([name, value]) => ({
    name,
    value: String(value),
  }));
}

function toEdge(raw: RawEdge): Edge {
  let target: Node | Switch;
  if (raw.switch) {
    target = toSwitch(raw.switch);
  } else if (raw.node) {
    target = toNode(raw.node);
  } else if (raw.uri) {
    target = { type: "named" as const, uri: raw.uri };
  } else {
    throw new Error("Edge must have node, uri, or switch");
  }
  return {
    target,
    relation: toRelation(raw.relation),
  };
}

function toSwitch(raw: RawSwitch): Switch {
  return {
    discriminator: raw.on,
    cases: raw.cases.map(toSwitchCase),
  };
}

function toSwitchCase(raw: RawSwitchCase): SwitchCase {
  if (raw.uri !== undefined) {
    const node: Node = { type: "named", uri: raw.uri };
    return { value: raw.uri, node };
  }
  const node = toNode(raw.node);
  const value = node.type === "named" ? node.uri : node.role;
  return { value, node };
}

function toRelation(raw: RawRelation): Relation {
  return {
    cardinality: raw.cardinality,
    ...(raw.slotName ? { slotName: raw.slotName } : {}),
    ...(raw.projection
      ? { projection: toRelationProjection(raw.projection) }
      : {}),
  };
}

function toRelationProjection(raw: { field: string }): RelationProjection {
  if (!raw.field) {
    throw new Error("Relation projection requires a field");
  }
  return { field: raw.field };
}

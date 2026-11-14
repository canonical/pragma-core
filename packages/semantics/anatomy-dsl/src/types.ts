export interface Specification {
  root: NamedNode;
}

export interface NamedNode {
  type: "named";
  uri: string;
  projection?: Projection;
  props?: Prop[];
  styles?: Style[];
  edges?: Edge[];
}

export interface AnonymousNode {
  type: "anonymous";
  role: string;
  projection?: Projection;
  styles?: Style[];
  edges?: Edge[];
}

export type Node = NamedNode | AnonymousNode;

export interface Edge {
  target: Node | Switch;
  relation: Relation;
}

export interface Relation {
  cardinality: string;
  slotName?: string;
  projection?: RelationProjection;
}

/**
 * Fragment-style binding of a node to graph data: a type condition (`on`),
 * a field path (`field`), or both — never neither.
 */
export type Projection =
  | { on: string; field?: string }
  | { on?: string; field: string };

/**
 * Traversal populating a slot: the field is required. Target typing lives on
 * the child node's own `on`, never on the relation.
 */
export interface RelationProjection {
  field: string;
}

export interface Style {
  key: string;
  /**
   * The authored spelling, verbatim: a scalar as written, a sequence in its
   * flow form (`[modifier.color.text, color.text]`). It is the evidence of
   * what the reference says, and `anatomy:styleValue` carries it unchanged.
   */
  value: string;
  /**
   * The symbols the value consumes, in fallback order — `liftSymbols` of the
   * authored value. Empty for a value that is one primitive. The transform
   * emits these as `anatomy:consumes`, an rdf:List, on a tuple whose key the
   * registry says takes a token.
   */
  symbols: string[];
  /**
   * Interaction state this value applies in — one of the closed set
   * `hover`, `active`, `focus`, `disabled`, `selected`, `expanded`,
   * `indeterminate`, `invalid`, `editing`. Absent = the default state.
   * Authored as an `@state` suffix on the style key
   * (`appearance.background@hover`). The set is closed by the shapes rather
   * than by the parser: the parser splits the marker off and carries it
   * verbatim. `editing` is experimental: its meaning and its platform
   * mapping may still change (`STYLE_STATES`).
   */
  state?: string;
}

/** What the vocabulary records about one state an `@state` suffix may name. */
export interface StyleStateEntry {
  /**
   * True on a state admitted before any reference implementation binds it,
   * whose meaning and platform mapping may still change.
   */
  readonly experimental: boolean;
}

/**
 * A pinned property value: the anatomy fixes one prop of the referenced
 * component at this tree position. References a property defined in the
 * design system ontology — the DSL never defines the prop surface itself.
 * Named nodes only: anonymous nodes have no prop surface to pin.
 */
export interface Prop {
  name: string;
  value: string;
}

export interface Switch {
  discriminator: "props" | "internal" | "override";
  cases: SwitchCase[];
}

export interface SwitchCase {
  value: string;
  node: Node;
}

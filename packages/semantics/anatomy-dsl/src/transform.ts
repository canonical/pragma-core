import { takesToken } from "./registry.generated.js";
import type {
  AnonymousNode,
  Edge,
  NamedNode,
  Node,
  Projection,
  Prop,
  Specification,
  Style,
  Switch,
} from "./types.js";

const PREFIX = "@prefix : <https://anatomy.canonical.com/> .";
/** The token graph's namespace, bound where a symbol is consumed. */
const DT_PREFIX = "@prefix dt: <https://dt.canonical.com/> .";
const INDENT = "    ";

export function anatomyToTTL(spec: Specification): string {
  const lines: string[] = [];
  lines.push("[] a :Specification ;");
  lines.push(`${INDENT}:rootNode [`);
  writeNode(lines, spec.root, 2);
  lines.push(`${INDENT}] .`);
  const body = lines.join("\n");
  // `dt:` is bound only where the document consumes a symbol: an anatomy of
  // pure structure — a switch and its cases, and nothing else — binds a
  // prefix it never uses otherwise, which every RDF linter reports.
  const header = body.includes(":consumes") ? [PREFIX, DT_PREFIX] : [PREFIX];
  return `${header.join("\n")}\n\n${body}\n`;
}

function writeNode(lines: string[], node: Node, depth: number): void {
  if (node.type === "named") {
    writeNamedNode(lines, node, depth);
  } else {
    writeAnonymousNode(lines, node, depth);
  }
  const props = node.type === "named" ? (node.props ?? []) : [];
  const styles = node.styles ?? [];
  const edges = node.edges ?? [];
  if (node.projection) {
    writeProjection(
      lines,
      node.projection,
      depth,
      props.length === 0 && styles.length === 0 && edges.length === 0,
    );
  }
  if (props.length > 0) {
    writeProps(lines, props, depth, styles.length === 0 && edges.length === 0);
  }
  if (styles.length > 0) {
    writeStyles(lines, styles, depth, edges.length === 0);
  }
  if (edges.length > 0) {
    writeEdges(lines, edges, depth);
  }
}

function writeNamedNode(lines: string[], node: NamedNode, depth: number): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}a :NamedNode ;`);
  const hasMore =
    node.projection !== undefined ||
    (node.props && node.props.length > 0) ||
    (node.styles && node.styles.length > 0) ||
    (node.edges && node.edges.length > 0);
  lines.push(`${indent}:uri "${node.uri}"${hasMore ? " ;" : ""}`);
}

function writeProps(
  lines: string[],
  props: Prop[],
  depth: number,
  isLast: boolean,
): void {
  const indent = INDENT.repeat(depth);
  const innerIndent = INDENT.repeat(depth + 1);
  lines.push(`${indent}:hasProp`);
  for (const [i, prop] of props.entries()) {
    const sep = i < props.length - 1 ? " ," : isLast ? "" : " ;";
    lines.push(
      `${innerIndent}[ a :Prop ; :propName "${prop.name}" ; :propValue "${prop.value}" ]${sep}`,
    );
  }
}

function writeAnonymousNode(
  lines: string[],
  node: AnonymousNode,
  depth: number,
): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}a :AnonymousNode ;`);
  const hasMore =
    node.projection !== undefined ||
    (node.styles && node.styles.length > 0) ||
    (node.edges && node.edges.length > 0);
  lines.push(`${indent}:role "${node.role}"${hasMore ? " ;" : ""}`);
}

function writeProjection(
  lines: string[],
  projection: Projection,
  depth: number,
  isLast: boolean,
): void {
  const indent = INDENT.repeat(depth);
  lines.push(
    `${indent}:hasProjection ${projectionTerm(projection)}${isLast ? "" : " ;"}`,
  );
}

function projectionTerm(projection: { on?: string; field?: string }): string {
  const parts = ["a :Projection"];
  if (projection.on !== undefined) {
    parts.push(`:projectionType "${projection.on}"`);
  }
  if (projection.field !== undefined) {
    parts.push(`:projectionField "${projection.field}"`);
  }
  return `[ ${parts.join(" ; ")} ]`;
}

function writeStyles(
  lines: string[],
  styles: Style[],
  depth: number,
  isLast: boolean,
): void {
  const indent = INDENT.repeat(depth);
  const innerIndent = INDENT.repeat(depth + 1);
  lines.push(`${indent}:hasStyle`);
  for (const [i, style] of styles.entries()) {
    const sep = i < styles.length - 1 ? " ," : isLast ? "" : " ;";
    const statePart =
      style.state !== undefined ? ` :styleState "${style.state}" ;` : "";
    lines.push(
      `${innerIndent}[ a :Style ; :styleKey "${style.key}" ;${statePart} :styleValue "${style.value}"${consumesPart(style)} ]${sep}`,
    );
  }
}

/**
 * THE SEAM. On a style tuple whose key the registry says takes a token,
 * `:consumes ( dt:a dt:b … )` — an rdf:List of the consumed symbols in
 * fallback order, whose head is the primary symbol. `:styleValue` keeps the
 * authored spelling verbatim beside it, terminal literal included, so the
 * evidence and the queryable form travel together.
 *
 * Nothing is emitted for a key the registry calls `primitive`, and nothing
 * for an `either` key whose value is one primitive — there is no symbol to
 * consume. A token-kind key with no symbols emits none either, and
 * StyleShape's generated disjunction is what turns that into a violation
 * rather than a silence.
 */
function consumesPart(style: Style): string {
  if (style.symbols.length === 0 || !takesToken(style.key)) return "";
  const members = style.symbols.map((symbol) => `dt:${symbol}`).join(" ");
  return ` ; :consumes ( ${members} )`;
}

function writeEdges(lines: string[], edges: Edge[], depth: number): void {
  const indent = INDENT.repeat(depth);
  for (const [i, edge] of edges.entries()) {
    if (i === 0) {
      lines.push(`${indent}:hasEdge [`);
    } else {
      lines.push(`${indent}] , [`);
    }
    writeEdge(lines, edge, depth + 1);
  }
  lines.push(`${indent}]`);
}

function writeEdge(lines: string[], edge: Edge, depth: number): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}a :Edge ;`);
  if (isSwitch(edge.target)) {
    lines.push(`${indent}:edgeSwitch [`);
    writeSwitch(lines, edge.target, depth + 1);
    lines.push(`${indent}] ;`);
  } else {
    lines.push(`${indent}:edgeTarget [`);
    writeNode(lines, edge.target, depth + 1);
    lines.push(`${indent}] ;`);
  }
  writeRelation(lines, edge, depth);
}

function writeSwitch(lines: string[], sw: Switch, depth: number): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}a :Switch ;`);
  lines.push(`${indent}:discriminator "${sw.discriminator}" ;`);
  for (const [i, sc] of sw.cases.entries()) {
    if (i === 0) {
      lines.push(`${indent}:hasCase [`);
    } else {
      lines.push(`${indent}] , [`);
    }
    writeSwitchCase(lines, sc, depth + 1);
  }
  lines.push(`${indent}]`);
}

function writeSwitchCase(
  lines: string[],
  sc: { node: Node },
  depth: number,
): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}a :SwitchCase ;`);
  lines.push(`${indent}:caseNode [`);
  writeNode(lines, sc.node, depth + 1);
  lines.push(`${indent}]`);
}

function writeRelation(lines: string[], edge: Edge, depth: number): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}:hasRelation [`);
  const inner = INDENT.repeat(depth + 1);
  const { relation } = edge;
  const predicates = ["a :Relation", `:cardinality "${relation.cardinality}"`];
  if (relation.slotName) {
    predicates.push(`:slotName "${relation.slotName}"`);
  }
  if (relation.projection) {
    predicates.push(`:hasProjection ${projectionTerm(relation.projection)}`);
  }
  for (const [i, predicate] of predicates.entries()) {
    const sep = i < predicates.length - 1 ? " ;" : "";
    lines.push(`${inner}${predicate}${sep}`);
  }
  lines.push(`${indent}]`);
}

function isSwitch(target: Node | Switch): target is Switch {
  return "discriminator" in target;
}

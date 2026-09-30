/**
 * The anatomy–token seam, design-system's end (ADR J §6.3, §8.2).
 *
 * Two exports, and they live in the same module deliberately: `assertBindingsResolve`
 * is where the law lives, so it belongs beside the derivation whose output it reads,
 * inside the enforced coverage scope, while `src/commands/transform.ts` — 250 lines of
 * pre-existing orchestration — stays outside it and gains only the call.
 *
 *   deriveTokenBindings(store)          the post-step: parse every non-empty
 *                                      ds:anatomyDsl literal, walk each tree, follow
 *                                      its uri: references, and emit one
 *                                      ds:TokenBinding record per consumed symbol per
 *                                      rank.
 *   assertBindingsResolve(records, …)   the law: every consumed symbol is a
 *                                      dt:TokenSymbol unless the register admits it.
 *
 * Nothing here parses CSS or reads a reference stylesheet; that is the derivation
 * (`src/anatomies/`). This module reads the anatomy literals the graph already holds.
 */

import type { Edge, Node, Specification, Switch } from "@canonical/anatomy-dsl";
import { parseAnatomyYAML } from "@canonical/anatomy-dsl";
import { DataFactory } from "n3";
import { CLASSES, NAMESPACES, PREDICATES } from "../constants.js";
import type { GraphStore } from "../graph/index.js";
import { dottedName, type SymbolIndex } from "./symbols.js";

const { blankNode, defaultGraph, literal, namedNode, quad } = DataFactory;

/**
 * The DSL's reserved URI for a position that accepts a user-provided component
 * (anatomy-dsl api-reference §10.3). It names no block, so the walk records its own
 * styles and does not recurse into it.
 */
const CUSTOM_URI = "$custom";

/** The path step the root node occupies, and the DSL's own spelling for it. */
const ROOT_STEP = "$root";

/** The state a record carries for the unmarked key. */
export const DEFAULT_STATE = "default";

/**
 * The prefixes the records introduce. The store carries no `PrefixMap`, so the
 * transform's call site adds these to the one it built from the table contexts —
 * without them the serializer writes the two reused anatomy terms and every symbol as
 * a full IRI.
 */
export const BINDING_PREFIXES: Readonly<Record<string, string>> = {
  anatomy: NAMESPACES.anatomy,
  dt: NAMESPACES.dt,
};

/**
 * A record's identity: the six-tuple of ADR J §6.3. `ds:consumesSymbol` is
 * functionally determined by it, which is why it is not a member.
 */
export interface BindingIdentity {
  /** The block that holds the record, as a full IRI. */
  block: string;
  /** The tree the binding was reached through; equal to `block` for an own-tree one. */
  viaBlock: string;
  /** The node's tree path in the `viaBlock`'s tree. */
  node: string;
  styleKey: string;
  styleState: string;
  /** 1-based position in the value's fallback order. */
  rank: number;
}

/** One derived record: an identity and the symbol it determines. */
export interface BindingRecord extends BindingIdentity {
  /** The symbol's dotted name, verbatim — `modifier.color.text`, not an IRI. */
  symbol: string;
}

/**
 * Severity, defined once for all three callers of the law (ADR J §5.3): a **finding**
 * sets the exit code non-zero in every mode, a **warning** is printed and never
 * changes it.
 */
export type Severity = "finding" | "warning";

/**
 * Where a warning's binding is WRITTEN, as against where it shows up.
 *
 * A component that references Button inherits Button's `@hover` and `@disabled`
 * differences at its own node path, so the state lint fires once per place and the
 * same handful of Button bindings account for most of the corpus's warnings. These
 * three fields are what `renderWarningLines` needs to say that once per origin
 * instead — and they are fields rather than prose so the grouping never matches on a
 * message.
 */
export interface WarningOrigin {
  /** The block whose own tree carries the `@state` key, as a full IRI. */
  originBlock: string;
  /** The anatomy the binding surfaces in — the origin, or one that references it. */
  surfacesIn: string;
  /** The binding itself, as `styleKey@state`. */
  binding: string;
}

/** One thing the derivation or the law has to say. */
export interface BindingFinding {
  /** A stable short code, so a caller can group without matching prose. */
  code: string;
  severity: Severity;
  message: string;
  /** The block the finding is about, as a full IRI, where there is one. */
  block?: string;
  /** Carried by the state lint alone, which renders grouped by origin. */
  origin?: WarningOrigin;
  /**
   * Carried by a parse failure met through a `uri:` reference: the block whose tree
   * reached the unparseable one, and so lost the records it would have reached.
   */
  reachedFrom?: string;
}

/** What `deriveTokenBindings` derived, and what it could not. */
export interface DeriveResult {
  /** One per identity, in a stable order: block, then discovery order. */
  records: BindingRecord[];
  findings: BindingFinding[];
  /** Non-empty `ds:anatomyDsl` literals seen. */
  anatomies: number;
  /** How many of those parsed. A parse failure skips the anatomy, never the block. */
  parsed: number;
}

/** True when any finding would set the exit code — the one place that decides it. */
export function hasFinding(findings: readonly BindingFinding[]): boolean {
  return findings.some((finding) => finding.severity === "finding");
}

/** The exit code a set of findings implies. */
export function exitCodeFor(findings: readonly BindingFinding[]): number {
  return hasFinding(findings) ? 1 : 0;
}

/** A record's identity as one string, for de-duplication and for the Coda key. */
export function identityKey(identity: BindingIdentity): string {
  return [
    identity.block,
    identity.viaBlock,
    identity.node,
    identity.styleKey,
    identity.styleState,
    String(identity.rank),
  ].join("");
}

/**
 * Resolve a DSL `uri:` reference to a `ds:` subject IRI.
 *
 * The literals carry three spellings for one thing: the bare dotted local name
 * (`global.subcomponent.field_label`), the prefixed form (`ds:global.component.card`),
 * and the retired `ds:tier.kind:PascalCase` form. Only the prefix is stripped here —
 * the hyphen/underscore and PascalCase drift is corrected in the data by J-4 (AT.19),
 * and until then a reference that resolves to no subject is a finding, never a silent
 * repair.
 */
export function referenceIri(uri: string): string {
  const local = uri.startsWith("ds:") ? uri.slice("ds:".length) : uri;
  return `${NAMESPACES.ds}${local}`;
}

/** The step a node contributes to a path: its `uri`, or its `role` where it has none. */
function stepName(node: Node): string {
  return node.type === "named" ? node.uri : node.role;
}

/** Every step name an edge contributes, in edge order — a switch contributes one per case. */
function edgeSteps(edge: Edge): { name: string; node: Node }[] {
  const target = edge.target;
  if (isSwitch(target)) {
    return target.cases.map((switchCase) => ({
      name: `case[${switchCase.value}]`,
      node: switchCase.node,
    }));
  }
  return [{ name: stepName(target), node: target }];
}

function isSwitch(target: Node | Switch): target is Switch {
  return (target as Switch).cases !== undefined;
}

/**
 * The children of a node, each with the path step it occupies.
 *
 * A step whose name recurs among its siblings carries a 1-based ordinal in brackets,
 * in edge order. It is not decoration: `apps_launchpad.component.button` has two
 * sibling `role: icon container` nodes under `$root/content container`, told apart
 * only by their slot, and without the ordinal their records would share an identity.
 */
export function childSteps(node: Node): { step: string; node: Node }[] {
  const flat = (node.edges ?? []).flatMap(edgeSteps);
  const totals = new Map<string, number>();
  for (const entry of flat) {
    totals.set(entry.name, (totals.get(entry.name) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return flat.map((entry) => {
    // Every name was counted in the loop above, so the lookup cannot miss.
    const total = totals.get(entry.name) as number;
    const ordinal = (seen.get(entry.name) ?? 0) + 1;
    seen.set(entry.name, ordinal);
    return {
      step: total > 1 ? `${entry.name}[${ordinal}]` : entry.name,
      node: entry.node,
    };
  });
}

interface WalkContext {
  block: string;
  anatomies: ReadonlyMap<string, string>;
  /** Every `ds:` subject the graph holds, so an empty anatomy is not a dangling one. */
  blocks: ReadonlySet<string>;
  records: BindingRecord[];
  findings: BindingFinding[];
  /**
   * Blocks whose tree has been walked for this root, so a cycle terminates — and so
   * a subcomponent reached by two references yields one record per identity and not
   * one per reaching tuple. It is the whole de-duplication mechanism: the referenced
   * tree restarts at `$root` under its own `viaBlock`, so a second reaching would
   * produce byte-identical identities. That two records never share an identity is
   * asserted by the law (`assertBindingsResolve`), not defended twice here.
   */
  visited: Set<string>;
}

function walkNode(
  context: WalkContext,
  node: Node,
  viaBlock: string,
  path: string,
): void {
  for (const style of node.styles ?? []) {
    for (const [index, symbol] of style.symbols.entries()) {
      context.records.push({
        block: context.block,
        viaBlock,
        node: path,
        styleKey: style.key,
        styleState: style.state ?? DEFAULT_STATE,
        rank: index + 1,
        symbol,
      });
    }
  }

  for (const child of childSteps(node)) {
    walkNode(context, child.node, viaBlock, `${path}/${child.step}`);
    // A child with a `uri` is both a step for the styles THIS tree writes on it and a
    // recursion point for the referenced block's own tree, which restarts at `$root`
    // under its own `viaBlock`.
    if (child.node.type === "named" && child.node.uri !== CUSTOM_URI) {
      walkReference(context, child.node.uri);
    }
  }
}

function walkReference(context: WalkContext, uri: string): void {
  const iri = referenceIri(uri);
  if (context.visited.has(iri)) {
    return;
  }
  context.visited.add(iri);

  const literalText = context.anatomies.get(iri);
  if (literalText === undefined) {
    if (!context.blocks.has(iri)) {
      context.findings.push({
        code: "X11",
        severity: "finding",
        message: `${context.block}: uri: ${uri} resolves to no ds: subject`,
        block: context.block,
      });
    }
    // The subject exists and its anatomy is empty: nothing to walk, and nothing
    // wrong — a block nobody has authored an anatomy for yet is not a dangling uri:.
    return;
  }

  const specification = parse(context, literalText, iri, context.block);
  if (specification === null) {
    return;
  }
  walkNode(context, specification.root, iri, ROOT_STEP);
}

function parse(
  context: WalkContext,
  text: string,
  block: string,
  reachedFrom?: string,
): Specification | null {
  try {
    return parseAnatomyYAML(text);
  } catch (error) {
    const via =
      reachedFrom === undefined ? "" : `, reached from ${reachedFrom}`;
    context.findings.push({
      code: "X16",
      severity: "finding",
      message: `${block}: ds:anatomyDsl does not parse as an anatomy document${via} — ${(error as Error).message}`,
      block,
      ...(reachedFrom === undefined ? {} : { reachedFrom }),
    });
    return null;
  }
}

/**
 * Every non-empty `ds:anatomyDsl` literal in the store, keyed by its subject IRI.
 *
 * Exported because `bindings` needs the same reading over a staged directory: it
 * loads the anatomies into a store and calls `deriveTokenBindings` on it, so the Coda
 * plan and the graph post-step derive the closure by one code path and cannot drift.
 */
export function readAnatomies(store: GraphStore): Map<string, string> {
  const anatomies = new Map<string, string>();
  for (const candidate of store.getQuads()) {
    if (candidate.predicate.value !== PREDICATES.anatomyDsl) {
      continue;
    }
    if (candidate.subject.termType !== "NamedNode") {
      continue;
    }
    const text = candidate.object.value;
    if (text.trim() === "") {
      continue;
    }
    anatomies.set(candidate.subject.value, text);
  }
  return anatomies;
}

/**
 * Derive the record set from a set of anatomy literals, writing nothing.
 *
 * @param anatomies - subject IRI to non-empty `ds:anatomyDsl` text.
 * @param blocks - every `ds:` subject the graph holds. A `uri:` naming one of these
 *   whose anatomy is empty is not dangling; one naming none of them is (X11).
 *   Defaults to the anatomies' own keys, for a caller with no wider graph.
 */
export function deriveBindingRecords(
  anatomies: ReadonlyMap<string, string>,
  blocks: ReadonlySet<string> = new Set(anatomies.keys()),
): DeriveResult {
  const records: BindingRecord[] = [];
  const findings: BindingFinding[] = [];
  let parsed = 0;

  for (const block of [...anatomies.keys()].sort()) {
    const context: WalkContext = {
      block,
      anatomies,
      blocks,
      records,
      findings,
      // The root block counts as visited, so an anatomy that references itself — or a
      // cycle through a subcomponent — terminates.
      visited: new Set([block]),
    };
    const specification = parse(context, anatomies.get(block) as string, block);
    if (specification === null) {
      continue;
    }
    parsed += 1;
    walkNode(context, specification.root, block, ROOT_STEP);
  }

  return { records, findings, anatomies: anatomies.size, parsed };
}

/* ────────────────────────────────────────────────────────────────────────────
 * The law (ADR J §8.2), and the exit-code table it implements (§5.3)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * One row of `anatomies/register.yaml`.
 *
 * The type lives here, beside the law that reads it, because the register IS the
 * law's exception clause: `assertBindingsResolve` is the only thing that decides
 * whether a row admits an element. `src/anatomies/register.ts` owns the file — reading
 * it, writing it, and preserving the hand-written `rationale` across a regeneration.
 */
export interface RegisterRow {
  /** The block's dotted local name; `null` for a token-side row (X10, X14). */
  uri: string | null;
  /** The node's tree path; `null` for a row no key binds, and for a token-side row. */
  node: string | null;
  key: string | null;
  state: string | null;
  /** The element as written — a symbol spelling, or an S4 variable for X14. */
  value: string;
  category: string;
  /** Symbols weighed and rejected, for the reader. */
  considered: string[];
  /** Hand-written, and preserved verbatim by `validate --write-register`. */
  rationale?: string;
  date: string;
}

/**
 * The register categories that are DERIVED FROM RESOLUTION, and so the ones that
 * admit an unresolved element (§5.3's invariant). Every other category is checked
 * against its own input and admits nothing here.
 */
export const RESOLUTION_CATEGORIES: readonly string[] = [
  "X1",
  "X2",
  "X5",
  "X7",
  "X15",
];

/** The category for an element outside its key's `tokenNamespace` set. */
export const NAMESPACE_CATEGORY = "X8";

/** What the law needs, each input gating the checks that read it. */
export interface LawInputs {
  /** S1 + S2. The only thing an element is asked to resolve against. */
  symbols: SymbolIndex;
  /** `anatomies/register.yaml`, already read. */
  register: readonly RegisterRow[];
  /**
   * The dotted prefixes a style key admits, from the imported registry. Omit to skip
   * the namespace check entirely rather than to run it against an empty set — a
   * missing registry must not turn every binding into an X8 finding.
   */
  tokenNamespace?: (key: string) => readonly string[] | undefined;
  /**
   * `source.json`'s escape hatch. Suppresses the unresolved-symbol finding and
   * nothing else, for the window inside the act in which Coda holds the new literals
   * but the register has not yet been regenerated from them.
   */
  allowUnboundSymbols?: boolean;
}

/** True when a register row admits this record's element. */
function admits(row: RegisterRow, record: BindingRecord): boolean {
  if (row.value !== record.symbol) {
    return false;
  }
  // A row that names a field pins the admission to that binding; a row that leaves it
  // null admits the element wherever it appears. The register writes a block's dotted
  // local name, which is what a reader reads, so it is resolved to the IRI rather than
  // the IRI being shortened to match it.
  return (
    (row.uri === null || referenceIri(row.uri) === record.block) &&
    (row.node === null || row.node === record.node) &&
    (row.key === null || row.key === record.styleKey) &&
    (row.state === null || row.state === record.styleState)
  );
}

/** Whether a category admits an unresolved element at all. */
function isResolutionRow(row: RegisterRow): boolean {
  return RESOLUTION_CATEGORIES.includes(row.category);
}

function describe(record: BindingRecord): string {
  return `${record.block} ${record.node} ${record.styleKey}@${record.styleState} rank ${record.rank}`;
}

/**
 * Run the law over a record set.
 *
 * The exit-code table of §5.3, in the order that table gives, minus the rows whose
 * input is a reference stylesheet or a change report — those belong to
 * `anatomies validate`, which has them, and each is checked against its own input
 * there. What is here is every row an in-memory record set can decide.
 */
export function checkBindings(
  records: readonly BindingRecord[],
  inputs: LawInputs,
): BindingFinding[] {
  const findings: BindingFinding[] = [];
  const resolves = (symbol: string): boolean =>
    inputs.symbols.names.has(symbol);

  // Two records may never share an identity (§5.3's view invariant): the identity is
  // the Coda upsert's key, so a collision would silently merge two bindings into one
  // row.
  const byIdentity = new Map<string, BindingRecord[]>();
  for (const record of records) {
    const key = identityKey(record);
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), record]);
  }
  for (const [key, group] of byIdentity) {
    if (group.length > 1) {
      findings.push({
        code: "IDENTITY",
        severity: "finding",
        message: `${group.length} records share the identity ${key} — the identity is the Coda upsert key, so they would merge into one row`,
        block: group[0].block,
      });
    }
  }

  // An element that resolves in neither stratum needs exactly one admitting row.
  for (const record of records) {
    if (resolves(record.symbol)) {
      continue;
    }
    const admitting = inputs.register.filter(
      (row) => isResolutionRow(row) && admits(row, record),
    );
    if (admitting.length === 0) {
      if (inputs.allowUnboundSymbols !== true) {
        findings.push({
          code: "UNRESOLVED",
          severity: "finding",
          message: `${describe(record)} consumes ${record.symbol}, which resolves in neither S1 nor S2 and has no register row in ${RESOLUTION_CATEGORIES.join(", ")}`,
          block: record.block,
        });
      }
      continue;
    }
    if (admitting.length > 1) {
      findings.push({
        code: "AMBIGUOUS",
        severity: "finding",
        message: `${describe(record)} consumes ${record.symbol}, which ${admitting.length} register rows admit — the invariant is exactly one`,
        block: record.block,
      });
    }
  }

  // The namespace check, and the X8 row that admits a violation of it.
  if (inputs.tokenNamespace !== undefined) {
    const namespaceOf = inputs.tokenNamespace;
    for (const record of records) {
      const admitted = namespaceOf(record.styleKey);
      if (admitted === undefined || admitted.length === 0) {
        continue;
      }
      if (admitted.some((prefix) => record.symbol.startsWith(prefix))) {
        continue;
      }
      const rows = inputs.register.filter(
        (row) => row.category === NAMESPACE_CATEGORY && admits(row, record),
      );
      if (rows.length === 0) {
        findings.push({
          code: NAMESPACE_CATEGORY,
          severity: "finding",
          message: `${describe(record)} consumes ${record.symbol}, outside ${record.styleKey}'s tokenNamespace set (${admitted.join(", ")}), with no ${NAMESPACE_CATEGORY} row`,
          block: record.block,
        });
      }
    }
  }

  // A resolution row whose element resolves, or that names no live binding, is stale:
  // the register would then be carrying an exception that no longer exists, which is
  // the drift it exists to prevent.
  const live = new Set(records.map((record) => record.symbol));
  for (const row of inputs.register) {
    if (!isResolutionRow(row)) {
      continue;
    }
    if (row.key !== null && resolves(row.value)) {
      findings.push({
        code: "STALE_RESOLVED",
        severity: "finding",
        message: `register row ${row.category} ${row.uri ?? "-"} ${row.value} names an element that resolves in S1 or S2`,
      });
      continue;
    }
    if (!live.has(row.value)) {
      findings.push({
        code: "STALE_ORPHAN",
        severity: "finding",
        message: `register row ${row.category} ${row.uri ?? "-"} ${row.value} names no element any value in the corpus consumes`,
      });
    }
  }

  findings.push(...stateDifferences(records));
  return findings;
}

/** The lint whose warnings are rendered once per origin rather than once per place. */
const GROUPED_CODE = "AT11";

/** A block's own dotted name, for a line a person reads rather than a machine. */
function blockName(iri: string): string {
  return iri.replace(NAMESPACES.ds, "");
}

/**
 * The warning lines a run prints: every warning verbatim, except the state lint,
 * which is collapsed to one line per ORIGINATING anatomy.
 *
 * The lint fires once per (block, via, node, key, state), and a reference inherits
 * its target's state differences at its own node path — so Button's differing
 * bindings surface again in every anatomy that embeds a Button, and the ungrouped
 * list is hundreds of lines saying the same half-dozen things. Grouping is a
 * RENDERING choice and only that: the lint still fires per place, `--json` still
 * carries every warning, and a FINDING is never grouped — a finding is about one
 * place, and the place is the point.
 */
export function renderWarningLines(
  findings: readonly BindingFinding[],
): string[] {
  const verbatim: string[] = [];
  const grouped = new Map<
    string,
    { bindings: Set<string>; anatomies: Set<string> }
  >();
  for (const finding of findings) {
    if (finding.severity !== "warning") {
      continue;
    }
    const origin = finding.origin;
    if (finding.code !== GROUPED_CODE || origin === undefined) {
      verbatim.push(`  ⚠ ${finding.code} ${finding.message}`);
      continue;
    }
    const entry = grouped.get(origin.originBlock) ?? {
      bindings: new Set<string>(),
      anatomies: new Set<string>(),
    };
    entry.bindings.add(origin.binding);
    entry.anatomies.add(origin.surfacesIn);
    grouped.set(origin.originBlock, entry);
  }
  const lines = [...grouped.entries()]
    .map(([block, entry]) => ({
      name: blockName(block),
      bindings: [...entry.bindings].sort(),
      anatomies: entry.anatomies.size,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((group) => {
      const differ =
        group.bindings.length === 1
          ? "1 state binding differs from its base state"
          : `${group.bindings.length} state bindings differ from their base state`;
      const places =
        group.anatomies === 1
          ? "in its own anatomy alone"
          : `in ${group.anatomies} anatomies through references`;
      return `  ⚠ ${GROUPED_CODE} ${group.name}: ${differ} (${group.bindings.join(", ")}), surfacing ${places}`;
    });
  return [...verbatim, ...lines];
}

/**
 * AT.11's lint: a state key whose value differs from its base state's, at any rank.
 *
 * Reported, never rejected — the reference does it, and the reference is the source:
 * Button's `:disabled` reads a different symbol on purpose. A state whose base carries
 * no binding at all is not compared, which is Chip's `dismiss` child, given a `:hover`
 * background and no unmarked one.
 */
function stateDifferences(records: readonly BindingRecord[]): BindingFinding[] {
  const byTuple = new Map<string, BindingRecord[]>();
  for (const record of records) {
    const key = [
      record.block,
      record.viaBlock,
      record.node,
      record.styleKey,
    ].join(" ");
    byTuple.set(key, [...(byTuple.get(key) ?? []), record]);
  }

  const findings: BindingFinding[] = [];
  for (const group of byTuple.values()) {
    const base = new Map<number, string>();
    for (const record of group) {
      if (record.styleState === DEFAULT_STATE) {
        base.set(record.rank, record.symbol);
      }
    }
    if (base.size === 0) {
      continue;
    }
    const states = new Map<string, number[]>();
    for (const record of group) {
      if (record.styleState === DEFAULT_STATE) {
        continue;
      }
      if (base.get(record.rank) !== record.symbol) {
        states.set(record.styleState, [
          ...(states.get(record.styleState) ?? []),
          record.rank,
        ]);
      }
    }
    for (const [state, ranks] of states) {
      const first = group[0];
      findings.push({
        code: GROUPED_CODE,
        severity: "warning",
        message: `${first.block} ${first.node} ${first.styleKey}@${state} differs from its base state at rank ${ranks.join(", ")}`,
        block: first.block,
        // The group key fixes block, via, node and key together, so every record in
        // the group agrees on the tree the binding was reached through — and that
        // tree is the anatomy that wrote the `@state` key.
        origin: {
          originBlock: first.viaBlock,
          surfacesIn: first.block,
          binding: `${first.styleKey}@${state}`,
        },
      });
    }
  }
  return findings;
}

/** Read the records the graph holds back out of it, as written. */
export function readBindingRecords(store: GraphStore): BindingRecord[] {
  const records: BindingRecord[] = [];
  for (const entry of store.getQuads()) {
    if (entry.predicate.value !== PREDICATES.hasTokenBinding) {
      continue;
    }
    const fields = new Map<string, string>();
    for (const detail of store
      .getN3Store()
      .getQuads(entry.object, null, null, null)) {
      fields.set(detail.predicate.value, detail.object.value);
    }
    // Every field is written by `deriveTokenBindings`, the record's only writer, so
    // each lookup finds one. A record missing a field would be a graph nobody wrote,
    // and the view invariant that would catch it is the one this feeds.
    records.push({
      block: entry.subject.value,
      viaBlock: fields.get(PREDICATES.viaBlock) as string,
      node: fields.get(PREDICATES.bindingNode) as string,
      styleKey: fields.get(PREDICATES.styleKey) as string,
      styleState: fields.get(PREDICATES.styleState) as string,
      rank: Number(fields.get(PREDICATES.rank)),
      symbol: dottedName(
        fields.get(PREDICATES.consumesSymbol) as string,
      ) as string,
    });
  }
  return records;
}

/**
 * The transform guard: the law over the records the graph actually holds.
 *
 * It re-derives from the store's anatomy literals rather than taking the writer's word
 * for the record set, so a defect in the derivation shows up as a difference the guard
 * can see, and reads the written records back out of the graph. Both halves are cheap
 * — the parse is the cost, and it is milliseconds over 134 literals.
 *
 * Returns the findings; the caller decides what to do with a non-empty set, because
 * the three callers do different things (the transform refuses, `bindings` refuses,
 * `validate` sets an exit code).
 */
export function assertBindingsResolve(
  store: GraphStore,
  inputs: LawInputs,
): BindingFinding[] {
  const derivation = deriveBindingRecords(
    readAnatomies(store),
    new Set(store.getSubjects()),
  );
  const written = readBindingRecords(store);
  return [
    ...derivation.findings,
    ...checkBindings(written.length > 0 ? written : derivation.records, inputs),
  ];
}

/**
 * Write the record set into the graph, as a transform post-step.
 *
 * Runs beside `materializeInverses`: it reads what the extract already turned into
 * triples and adds what the anatomy literals say, so no new extract table and no new
 * Coda ingest is involved. A record is a blank node hung off the block, which is what
 * puts it in the block's own per-instance file — `GraphStore.getQuadsForSubject`
 * carries the blank-node closure — and what keeps `collectDataMetrics`'s `subjects`
 * count, and so pragma's entity count, unchanged.
 *
 * @note Impure — mutates `store`.
 */
export default function deriveTokenBindings(store: GraphStore): DeriveResult {
  const result = deriveBindingRecords(
    readAnatomies(store),
    new Set(store.getSubjects()),
  );
  const n3Store = store.getN3Store();

  for (const record of result.records) {
    const node = blankNode();
    store.addBlankNodeQuad(record.block, PREDICATES.hasTokenBinding, node);
    store.addQuadFromBlankNode(node, PREDICATES.type, CLASSES.tokenBinding);
    store.addQuadFromBlankNode(node, PREDICATES.viaBlock, record.viaBlock);
    store.addLiteralFromBlankNode(node, PREDICATES.bindingNode, record.node);
    store.addLiteralFromBlankNode(node, PREDICATES.styleKey, record.styleKey);
    store.addLiteralFromBlankNode(
      node,
      PREDICATES.styleState,
      record.styleState,
    );
    // `addLiteralFromBlankNode` writes a plain literal and the rank is an integer, so
    // this one quad goes through the n3 store directly — the same escape hatch
    // `writeDataset` uses to re-add typed terms.
    n3Store.addQuad(
      quad(
        node,
        namedNode(PREDICATES.rank),
        literal(String(record.rank), namedNode(`${NAMESPACES.xsd}integer`)),
        defaultGraph(),
      ),
    );
    store.addQuadFromBlankNode(
      node,
      PREDICATES.consumesSymbol,
      `${NAMESPACES.dt}${record.symbol}`,
    );
  }

  return result;
}

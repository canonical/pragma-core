/**
 * Populates the token graph from the authored source.
 *
 * Reads the DTCG token documents and the resolver, and writes the stratified
 * A-Box under `data/`. Output is deterministic: re-running with unchanged
 * source produces byte-identical files.
 *
 * It also reads one thing it does not author: `data/s4.web.ttl`, for the
 * routing behind the channel values of S3 (see `resolveChannels`). That is the
 * one edge that points up a stratum, and it is why the build order is
 * `catalogue → populate → catalogue`.
 *
 * Importing this module writes nothing. Run with `bun run populate`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
/** @canonical/design-tokens' authored source, resolved through the package. */
const TOKENS_ROOT = dirname(
  createRequire(import.meta.url).resolve(
    "@canonical/design-tokens/tokens/canonical/canonical.resolver.json",
  ),
);
const RESOLVER_REF = "canonical.resolver.json";
const DATA = resolve(PKG, "data");

const BASE = "https://dt.canonical.com/file/";
const DT = "https://dt.canonical.com/";

/** Group members that make a group worth lifting as a node. */
const GROUP_PROPS = [
  "$type",
  "$description",
  "$extensions",
  "$extends",
  "$deprecated",
];

/** The token types the specification defines. */
const SPEC_TYPES = new Set([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
]);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

interface Definition {
  name: string;
  file: string;
  node: Obj;
  inheritedType: string | null;
}

interface Group {
  name: string;
  file: string;
  node: Obj;
}

interface Source {
  files: string[];
  docs: Map<string, Obj>;
  definitions: Definition[];
  groups: Group[];
}

// ─────────────────────────────────────────────────────────────── source ─────

const isObj = (v: Json | undefined): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A document entry is a token exactly when it bears $value or $ref. */
const isToken = (v: Json | undefined): v is Obj =>
  isObj(v) && ("$value" in v || "$ref" in v);

function readDoc(rel: string): Obj {
  return JSON.parse(readFileSync(join(TOKENS_ROOT, rel), "utf8")) as Obj;
}

function walk(
  node: Json,
  path: string[],
  file: string,
  inheritedType: string | null,
  defs: Definition[],
  groups: Group[],
): void {
  if (!isObj(node)) return;

  const tokenHere = isToken(node);
  if (tokenHere) {
    const own = typeof node.$type === "string" ? node.$type : null;
    defs.push({
      name: path.join("."),
      file,
      node,
      inheritedType: own ?? inheritedType,
    });
    // A node bearing both a value and members is malformed under the format
    // specification; the source graph is lossless, so its members are walked too.
  }

  const groupType = typeof node.$type === "string" ? node.$type : inheritedType;
  if (!tokenHere && path.length > 0 && GROUP_PROPS.some((p) => p in node)) {
    groups.push({ name: path.join("."), file, node });
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith("$") && key !== "$root") continue;
    walk(node[key] as Json, [...path, key], file, groupType, defs, groups);
  }
}

export function loadSource(): Source {
  const resolver = readDoc(RESOLVER_REF);
  const refs = new Set<string>();

  const sets = (resolver.sets ?? {}) as Obj;
  for (const setName of Object.keys(sets)) {
    for (const s of ((sets[setName] as Obj).sources ?? []) as Json[]) {
      if (isObj(s) && typeof s.$ref === "string") refs.add(s.$ref);
    }
  }
  const modifiers = (resolver.modifiers ?? {}) as Obj;
  for (const modName of Object.keys(modifiers)) {
    const contexts = ((modifiers[modName] as Obj).contexts ?? {}) as Obj;
    for (const ctxName of Object.keys(contexts)) {
      for (const s of (contexts[ctxName] ?? []) as Json[]) {
        if (isObj(s) && typeof s.$ref === "string") refs.add(s.$ref);
      }
    }
  }

  const files = [...refs].sort();
  const docs = new Map<string, Obj>();
  const definitions: Definition[] = [];
  const groups: Group[] = [];
  for (const rel of files) {
    const doc = readDoc(rel);
    docs.set(rel, doc);
    walk(doc, [], rel, null, definitions, groups);
  }
  definitions.sort((a, b) => cmp(`${a.file}#${a.name}`, `${b.file}#${b.name}`));
  groups.sort((a, b) => cmp(`${a.file}#${a.name}`, `${b.file}#${b.name}`));
  return { files, docs, definitions, groups };
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ──────────────────────────────────────────────────────────── references ─────

/** The logical name a definition defines: the reserved $root segment stripped. */
const toSymbol = (name: string): string => name.replace(/\.\$root$/, "");

/** The whole-token alias target of a value, if the value is one. */
function aliasTarget(node: Obj): string | null {
  const v = node.$value;
  if (typeof v !== "string") return null;
  const m = /^\{(.+)\}$/.exec(v.trim());
  return m ? toSymbol(m[1]) : null;
}

/** Token paths named by JSON-Pointer references inside a value. */
function pointerTargets(value: Json, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) pointerTargets(v, out);
    return;
  }
  if (!isObj(value)) return;
  if (typeof value.$ref === "string") {
    const target = pointerToSymbol(value.$ref);
    if (target) out.add(target);
    return;
  }
  for (const key of Object.keys(value)) pointerTargets(value[key] as Json, out);
}

/** The token a JSON pointer addresses: the path up to its $value, dotted. */
function pointerToSymbol(pointer: string): string | null {
  if (!pointer.startsWith("#/")) return null;
  const segments = pointer.slice(2).split("/");
  const end = segments.indexOf("$value");
  const path = (end === -1 ? segments : segments.slice(0, end)).map((s) =>
    s.replace(/~1/g, "/").replace(/~0/g, "~"),
  );
  return path.length ? toSymbol(path.join(".")) : null;
}

// ───────────────────────────────────────────────────────────── resolution ────

interface Merged {
  tree: Obj;
  /** Authored name → the file whose definition of it won. */
  winner: Map<string, string>;
  /** Names where a token replaced a group or the reverse. */
  shapeCollisions: string[];
}

function clone(v: Json): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}

function mergeInto(
  dst: Obj,
  src: Obj,
  path: string[],
  collisions: string[],
): void {
  for (const key of Object.keys(src)) {
    const incoming = src[key] as Json;
    const existing = dst[key] as Json | undefined;
    const here = key.startsWith("$") && key !== "$root" ? path : [...path, key];
    if (
      isObj(incoming) &&
      isObj(existing) &&
      !isToken(incoming) &&
      !isToken(existing)
    ) {
      mergeInto(existing, incoming, here, collisions);
      continue;
    }
    if (existing !== undefined && isObj(incoming) && isObj(existing)) {
      if (isToken(incoming) !== isToken(existing))
        collisions.push(here.join("."));
    }
    dst[key] = clone(incoming);
  }
}

function layersFor(
  resolver: Obj,
  assignment: Record<string, string>,
): string[] {
  const layers: string[] = [];
  const order = (resolver.resolutionOrder ?? []) as Json[];
  for (const entry of order) {
    if (!isObj(entry) || typeof entry.$ref !== "string") continue;
    const [, kind, name] = entry.$ref.split("/");
    if (kind === "sets") {
      const set = ((resolver.sets as Obj)[name] ?? {}) as Obj;
      for (const s of (set.sources ?? []) as Json[]) {
        if (isObj(s) && typeof s.$ref === "string") layers.push(s.$ref);
      }
    } else if (kind === "modifiers") {
      const mod = ((resolver.modifiers as Obj)[name] ?? {}) as Obj;
      const chosen = assignment[name] ?? (mod.default as string | undefined);
      if (chosen === undefined) continue;
      const sources = ((mod.contexts as Obj)?.[chosen] ?? []) as Json[];
      for (const s of sources) {
        if (isObj(s) && typeof s.$ref === "string") layers.push(s.$ref);
      }
    }
  }
  return layers;
}

function mergeFor(
  src: Source,
  resolver: Obj,
  assignment: Record<string, string>,
): Merged {
  const tree: Obj = {};
  const winner = new Map<string, string>();
  const shapeCollisions: string[] = [];
  for (const rel of layersFor(resolver, assignment)) {
    const doc = src.docs.get(rel);
    if (!doc) continue;
    mergeInto(tree, doc, [], shapeCollisions);
    for (const def of src.definitions) {
      if (def.file === rel) winner.set(def.name, rel);
    }
  }
  return { tree, winner, shapeCollisions };
}

function getPath(tree: Obj, dotted: string): Json | undefined {
  let node: Json | undefined = tree;
  for (const seg of dotted.split(".")) {
    if (!isObj(node)) return undefined;
    node = node[seg] as Json | undefined;
  }
  return node;
}

function pointerInto(
  tree: Obj,
  pointer: string,
  depth: number,
): Json | undefined {
  if (depth > 32 || !pointer.startsWith("#/")) return undefined;
  let node: Json | undefined = tree;
  for (const raw of pointer.slice(2).split("/")) {
    const seg = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(node)) {
      node = node[Number(seg)] as Json | undefined;
      continue;
    }
    if (!isObj(node)) return undefined;
    node = node[seg] as Json | undefined;
  }
  return concretise(node, tree, depth + 1);
}

/** Reduce a value to concrete JSON: pointers followed, nested aliases resolved. */
function concretise(
  value: Json | undefined,
  tree: Obj,
  depth: number,
): Json | undefined {
  if (depth > 32 || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => concretise(v, tree, depth + 1) ?? null) as Json;
  }
  if (isObj(value)) {
    if (typeof value.$ref === "string")
      return pointerInto(tree, value.$ref, depth + 1);
    if (isToken(value))
      return concretise(value.$value as Json, tree, depth + 1);
    const out: Obj = {};
    for (const key of Object.keys(value).sort()) {
      const r = concretise(value[key] as Json, tree, depth + 1);
      if (r !== undefined) out[key] = r;
    }
    return out;
  }
  if (typeof value === "string") {
    const m = /^\{(.+)\}$/.exec(value.trim());
    if (m) {
      const target = getPath(tree, toSymbol(m[1]));
      const node = isToken(target)
        ? target
        : isObj(target)
          ? (target.$root as Json)
          : undefined;
      return isToken(node)
        ? concretise(node.$value as Json, tree, depth + 1)
        : undefined;
    }
  }
  return value;
}

interface Resolution {
  value: Json;
  /** Authored names of the definitions traversed, decision first. */
  chain: string[];
}

/**
 * Resolve a symbol under a merged tree, recording the whole-token route.
 * Channel-level pointers inside the terminal value are not route steps: they
 * compose one value from several definitions rather than continuing a chain.
 */
function resolveSymbol(
  symbol: string,
  merged: Merged,
  depth = 0,
): Resolution | null {
  if (depth > 32) return null;
  const direct = getPath(merged.tree, symbol);
  let name = symbol;
  let node: Json | undefined = direct;
  if (!isToken(node) && isObj(direct) && isToken(direct.$root)) {
    name = `${symbol}.$root`;
    node = direct.$root as Json;
  }
  if (!isToken(node)) return null;

  const alias = aliasTarget(node);
  if (alias) {
    const onward = resolveSymbol(alias, merged, depth + 1);
    if (!onward) return null;
    return { value: onward.value, chain: [name, ...onward.chain] };
  }
  const value = concretise(node.$value as Json, merged.tree, depth + 1);
  if (value === undefined) return null;
  return { value, chain: [name] };
}

// ────────────────────────────────────────────────────────────── turtle ───────

const escapeLiteral = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

const str = (s: string): string => `"${escapeLiteral(s)}"`;
const jsonLit = (v: Json): string => `${str(JSON.stringify(v))}^^rdf:JSON`;

/** A definition or group node: its file's IRI with the authored name as fragment. */
const nodeIri = (file: string, name: string): string =>
  `<${file}#${encodeURI(name)}>`;
const fileIri = (file: string): string => `<${file}>`;

/** Local names are safe for prefixed form when they avoid Turtle's delimiters. */
const SAFE_LOCAL = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
function term(prefix: string, local: string, expansion: string): string {
  if (SAFE_LOCAL.test(local) && !local.endsWith("."))
    return `${prefix}:${local}`;
  return `<${expansion}${encodeURI(local)}>`;
}
const symbolIri = (symbol: string): string => term("dt", symbol, DT);
/**
 * Encoding-side entities take an `axis.` or `context.` segment; concept-side
 * coordinates take `coordinate.`. Segregating the namespaces keeps the two
 * worlds distinguishable by IRI alone, without consulting a type.
 */
const axisIri = (axis: string): string => term("dt", `axis.${axis}`, DT);
const contextIri = (axis: string, ctx: string): string =>
  term("dt", `context.${axis}.${ctx}`, DT);
/** Coordinates are scoped by FAMILY, never by the axis that encodes them. */
const coordinateIri = (family: string, ctx: string): string =>
  term("dt", `coordinate.${family}.${ctx}`, DT);
const setIri = (name: string): string => term("dt", `set.${name}`, DT);

function list(items: string[]): string {
  return items.length === 0 ? "()" : `( ${items.join(" ")} )`;
}

const PREAMBLE = [
  "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
  "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
  "@prefix ds:  <https://ds.canonical.com/> .",
  "@prefix w3c-tokens: <https://dt.canonical.com/w3c-tokens/> .",
  "@prefix dt:  <https://dt.canonical.com/> .",
  `@base <${BASE}> .`,
  "",
].join("\n");

function header(lines: string[]): string {
  const bar = "#".repeat(79);
  return [
    bar,
    ...lines.map((l) => (l ? `# ${l}` : "#")),
    bar,
    "",
    PREAMBLE,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────── emit s1 ─────

function emitS1(src: Source, resolver: Obj): string {
  const out: string[] = [];
  out.push(
    header([
      "s1.ttl — the source graph",
      "",
      "Generated by src/populate.ts from the authored token documents and the",
      "resolver. Do not edit: re-run the populator.",
      "",
      "One node per token definition and per annotated group, addressed by the",
      "file's IRI with the authored name as fragment. Token symbols are minted",
      "from the authored name with the reserved $root segment stripped.",
    ]),
  );

  out.push("## Files\n");
  for (const rel of src.files) {
    const doc = src.docs.get(rel) as Obj;
    const lines = [
      `${fileIri(rel)}`,
      "    a w3c-tokens:File ;",
      `    w3c-tokens:path ${str(rel)}`,
    ];
    if (typeof doc.$schema === "string") {
      lines[lines.length - 1] += " ;";
      lines.push(`    w3c-tokens:schema ${str(doc.$schema)}`);
    }

    // The document root IS the root group: its group properties belong to the file.

    if (typeof doc.$description === "string") {
      lines[lines.length - 1] += " ;";
      lines.push(`    w3c-tokens:description ${str(doc.$description)}`);
    }

    if (typeof doc.$type === "string") {
      lines[lines.length - 1] += " ;";
      lines.push(`    w3c-tokens:type ${str(doc.$type)}`);
    }

    if (doc.$extensions !== undefined) {
      lines[lines.length - 1] += " ;";
      lines.push(
        `    w3c-tokens:extensions ${jsonLit(doc.$extensions as Json)}`,
      );
    }
    out.push(`${lines.join("\n")} .\n`);
  }

  out.push("## Token symbols\n");
  const symbols = [
    ...new Set(src.definitions.map((d) => toSymbol(d.name))),
  ].sort(cmp);
  // The label is the dotted name, and it is carried because a consumer that
  // has only the IRI cannot recover it: deriving a name from the IRI means
  // choosing a separator, and pragma's kernel chooses slashes — `color/text`
  // for `dt:color.text`, which is not the notation this graph uses anywhere.
  for (const s of symbols)
    out.push(`${symbolIri(s)} a dt:TokenSymbol ; rdfs:label ${str(s)} .`);
  out.push("");

  out.push("## Definitions\n");
  for (const def of src.definitions) {
    const props: string[] = [
      "a w3c-tokens:Token",
      `w3c-tokens:name ${str(def.name)}`,
      `w3c-tokens:inFile ${fileIri(def.file)}`,
      `dt:symbol ${symbolIri(toSymbol(def.name))}`,
    ];
    if ("$value" in def.node)
      props.push(`w3c-tokens:value ${jsonLit(def.node.$value as Json)}`);
    if (typeof def.node.$ref === "string")
      props.push(`w3c-tokens:ref ${str(def.node.$ref)}`);
    if (typeof def.node.$type === "string")
      props.push(`w3c-tokens:type ${str(def.node.$type)}`);
    if (typeof def.node.$description === "string")
      props.push(`w3c-tokens:description ${str(def.node.$description)}`);
    if (def.node.$extensions !== undefined)
      props.push(
        `w3c-tokens:extensions ${jsonLit(def.node.$extensions as Json)}`,
      );
    if (def.node.$deprecated !== undefined)
      props.push(
        `w3c-tokens:deprecated ${jsonLit(def.node.$deprecated as Json)}`,
      );
    if (def.inheritedType && SPEC_TYPES.has(def.inheritedType))
      props.push(`dt:tokenType w3c-tokens:${def.inheritedType}`);
    const alias = aliasTarget(def.node);
    if (alias) props.push(`dt:aliasOf ${symbolIri(alias)}`);
    const refs = new Set<string>();
    pointerTargets((def.node.$value ?? null) as Json, refs);
    for (const r of [...refs].sort(cmp))
      props.push(`dt:refersTo ${symbolIri(r)}`);
    out.push(
      `${nodeIri(def.file, def.name)}\n    ${props.join(" ;\n    ")} .\n`,
    );
  }

  out.push("## Annotated groups\n");
  for (const grp of src.groups) {
    const props: string[] = [
      "a w3c-tokens:Group",
      `w3c-tokens:name ${str(grp.name)}`,
      `w3c-tokens:inFile ${fileIri(grp.file)}`,
    ];
    if (typeof grp.node.$type === "string")
      props.push(`w3c-tokens:type ${str(grp.node.$type)}`);
    if (typeof grp.node.$description === "string")
      props.push(`w3c-tokens:description ${str(grp.node.$description)}`);
    if (grp.node.$extensions !== undefined)
      props.push(
        `w3c-tokens:extensions ${jsonLit(grp.node.$extensions as Json)}`,
      );
    if (typeof grp.node.$extends === "string")
      props.push(`w3c-tokens:extends ${str(grp.node.$extends)}`);
    if (grp.node.$deprecated !== undefined)
      props.push(
        `w3c-tokens:deprecated ${jsonLit(grp.node.$deprecated as Json)}`,
      );
    out.push(
      `${nodeIri(grp.file, grp.name)}\n    ${props.join(" ;\n    ")} .\n`,
    );
  }

  out.push("## Resolver\n");
  const setNames = Object.keys((resolver.sets ?? {}) as Obj).sort(cmp);
  const axisNames = Object.keys((resolver.modifiers ?? {}) as Obj).sort(cmp);
  const orderIris: string[] = [];
  for (const entry of (resolver.resolutionOrder ?? []) as Json[]) {
    if (!isObj(entry) || typeof entry.$ref !== "string") continue;
    const [, kind, name] = entry.$ref.split("/");
    orderIris.push(kind === "sets" ? setIri(name) : axisIri(name));
  }
  const resolverProps = [
    "a w3c-tokens:Resolver",
    `w3c-tokens:version ${str(String(resolver.version ?? ""))}`,
    ...(typeof resolver.$schema === "string"
      ? [`w3c-tokens:schema ${str(resolver.$schema)}`]
      : []),
    ...setNames.map((n) => `w3c-tokens:set ${setIri(n)}`),
    ...axisNames.map((n) => `w3c-tokens:modifier ${axisIri(n)}`),
    `w3c-tokens:resolutionOrder ${list(orderIris)}`,
  ];
  out.push(
    `${fileIri(RESOLVER_REF)}\n    ${resolverProps.join(" ;\n    ")} .\n`,
  );

  for (const name of setNames) {
    const set = ((resolver.sets as Obj)[name] ?? {}) as Obj;
    const sources = ((set.sources ?? []) as Json[])
      .filter((s): s is Obj => isObj(s) && typeof s.$ref === "string")
      .map((s) => fileIri(s.$ref as string));
    const props = [
      "a w3c-tokens:TokenSet",
      `w3c-tokens:name ${str(name)}`,
      ...(typeof set.description === "string"
        ? [`w3c-tokens:description ${str(set.description)}`]
        : []),
      `w3c-tokens:includes ${list(sources)}`,
    ];
    out.push(`${setIri(name)}\n    ${props.join(" ;\n    ")} .\n`);
  }

  for (const axis of axisNames) {
    const mod = ((resolver.modifiers as Obj)[axis] ?? {}) as Obj;
    const contexts = Object.keys((mod.contexts ?? {}) as Obj).sort(cmp);
    const props = [
      "a w3c-tokens:ResolverModifier",
      `w3c-tokens:name ${str(axis)}`,
      ...(typeof mod.description === "string"
        ? [`w3c-tokens:description ${str(mod.description)}`]
        : []),
      ...contexts.map((c) => `w3c-tokens:context ${contextIri(axis, c)}`),
      ...(typeof mod.default === "string"
        ? [`w3c-tokens:default ${contextIri(axis, mod.default)}`]
        : []),
    ];
    out.push(`${axisIri(axis)}\n    ${props.join(" ;\n    ")} .\n`);
    for (const ctx of contexts) {
      const sources = (((mod.contexts as Obj)[ctx] ?? []) as Json[])
        .filter((s): s is Obj => isObj(s) && typeof s.$ref === "string")
        .map((s) => fileIri(s.$ref as string));
      out.push(
        `${contextIri(axis, ctx)}\n    a w3c-tokens:ResolverContext ;\n` +
          `    w3c-tokens:name ${str(ctx)} ;\n` +
          `    w3c-tokens:includes ${list(sources)} .\n`,
      );
    }
  }

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

// ─────────────────────────────────────────────────────────────── emit s2 ─────

/** Design-system counterparts, by the names the two vocabularies actually use. */
const FAMILY_ENCODING: Record<string, string> = {
  theme: "mode",
  surface: "surface",
  anticipation: "anticipation",
  criticality: "criticality",
  emphasis: "_emphasis",
  importance: "importance",
  lifecycle: "lifecycle",
  release: "release",
};
const CONTEXT_ENCODING: Record<string, string> = {
  "lifecycle.inProgress": "in_progress",
  "surface.layer1": "surface1",
  "surface.layer2": "surface2",
  "surface.layer3": "surface3",
  "surface.modal": "modal",
};
/**
 * Contexts with no design-system counterpart. Each is a gap in the concept
 * layer, not a property of the encoding: the context is real and the value it
 * produces is real; only the concept view is incomplete.
 */
const UNENCODED_CONTEXTS = new Set(["surface.contrasted", "emphasis.branded"]);

/** Axes with no design-system family, and axes outside the contextual model. */
const UNENCODED_AXES = new Set(["typography", "breakpoint"]);

const LEVEL: Record<string, string> = {
  theme: "dt:level.shell",
  typography: "dt:level.shell",
  surface: "dt:level.layout",
  anticipation: "dt:level.local",
  criticality: "dt:level.local",
  emphasis: "dt:level.local",
  importance: "dt:level.local",
  lifecycle: "dt:level.local",
  release: "dt:level.local",
};

/**
 * The family's own name, which scopes its coordinates. Distinct from the IRI
 * local name: `_emphasis` carries a leading underscore the design-system data
 * uses to escape the term, and that spelling has no place in a coordinate.
 */
const familyName = (axis: string): string =>
  (FAMILY_ENCODING[axis] ?? axis).replace(/^_/, "");

/**
 * A family whose default is not one of its own contexts. The resolver names
 * `light`, because an authoring encoding must pick something; the runtime
 * encoding consults the platform instead. The indeterminate coordinate is
 * where those two facts are reconciled, and `otherwise` records the resolver's
 * answer so nothing is invented here.
 */
const INDETERMINATE: Record<string, { preference: string; otherwise: string }> =
  {
    theme: {
      preference: "dt:preference.colorScheme",
      otherwise: "dt:coordinate.mode.light",
    },
  };
const PROVIDES_TYPE: Record<string, string> = {
  typography: "typography",
  breakpoint: "dimension",
};

export interface Coverage {
  axis: string;
  symbols: string[];
  contexts: Map<string, string[]>;
}

export function observedCoverage(src: Source, resolver: Obj): Coverage[] {
  const out: Coverage[] = [];
  const modifiers = (resolver.modifiers ?? {}) as Obj;
  for (const axis of Object.keys(modifiers).sort(cmp)) {
    const contexts = ((modifiers[axis] as Obj).contexts ?? {}) as Obj;
    const perContext = new Map<string, string[]>();
    const all = new Set<string>();
    for (const ctx of Object.keys(contexts).sort(cmp)) {
      const files = new Set(
        ((contexts[ctx] ?? []) as Json[])
          .filter((s): s is Obj => isObj(s) && typeof s.$ref === "string")
          .map((s) => s.$ref as string),
      );
      const symbols = [
        ...new Set(
          src.definitions
            .filter((d) => files.has(d.file))
            .map((d) => toSymbol(d.name)),
        ),
      ].sort(cmp);
      perContext.set(ctx, symbols);
      for (const s of symbols) all.add(s);
    }
    out.push({ axis, symbols: [...all].sort(cmp), contexts: perContext });
  }
  return out;
}

/**
 * The prefix a channel takes, by the rung its family attaches at. A family at
 * the shell rung gets none: a mode is not a channel — nothing reads
 * `--modifier-color-text` to mean "whatever the theme says", because the theme
 * says it through the symbol itself. Nor does a family with no rung declared.
 *
 * The rule is THE LEVEL AS DECLARED, and one contract declares none:
 * `dt:contract.product` has `dt:provision` and `dt:providesType` and no
 * `dt:level` (shape-valid — `dt:ContractShape` caps `dt:level` at one and
 * requires none). Its axis is observed to cover 43 symbols, 12 `spacing.*`
 * and 31 `typography.*`, so declaring it at the local rung and giving it a
 * design-system family would take the mint from 25 to 68. That is not done
 * here: whether `product` is a local-level family is an owner decision about
 * S2's contracts, not something a generator may assume, and the level it does
 * not declare is the reason it mints nothing. A future declaration therefore
 * changes the mint BY DESIGN rather than by accident.
 *
 * `importance` is the other half of the same story and needs no ruling: it
 * declares `dt:level.local` and its resolver contexts are placeholders, so
 * observed coverage is 0 symbols and there is nothing to mint a channel of.
 */
const CHANNEL_PREFIX: Record<string, "modifier" | "surface"> = {
  "dt:level.local": "modifier",
  "dt:level.layout": "surface",
};

/** A channel: the symbol minted, and the symbol it provisions. */
export interface Channel {
  /** The channel's own dotted name — `modifier.color.text`. */
  name: string;
  /** The symbol it provisions — `color.text`. */
  of: string;
  kind: "modifier" | "surface";
}

/**
 * The channels observed coverage implies: one per (rung prefix, covered
 * symbol). A channel is nothing but a name for "the value the family at this
 * rung is provisioning for that symbol right now", so its existence is
 * entirely determined by which symbols a family at that rung covers — which is
 * what `dt:covers` already says. Nothing here is a decision, and nothing here
 * may be written by hand: a channel the resolver does not imply is a channel of
 * nothing.
 *
 * Coverage hangs on the FAMILY, and only an axis with a design-system family
 * gets one emitted, so an axis with no counterpart contributes nothing — that
 * is the same condition `emitS2` applies, read from the same place.
 */
export function mintChannels(coverage: Coverage[]): Channel[] {
  const byName = new Map<string, Channel>();
  for (const cov of coverage) {
    if (!FAMILY_ENCODING[cov.axis]) continue;
    const kind = CHANNEL_PREFIX[LEVEL[cov.axis] ?? ""];
    if (!kind) continue;
    for (const of of cov.symbols) {
      const name = `${kind}.${of}`;
      if (!byName.has(name)) byName.set(name, { name, of, kind });
    }
  }
  return [...byName.values()].sort((a, b) => cmp(a.name, b.name));
}

function emitS2(coverage: Coverage[]): string {
  const out: string[] = [];
  out.push(
    header([
      "s2.ttl — the transform: contracts",
      "",
      "Generated by src/populate.ts. NOT AUTHORITATIVE: contracts are authored,",
      "not derived. Coverage here is OBSERVED — the symbols each family's context",
      "files actually rebind — and stands as a draft for review, not as the",
      "declared coverage it will become.",
      "",
      "Coverage and exclusivity hang on the family, not on the contract. A",
      "coordinate is scoped by its family and carries the concept it means;",
      "the resolver's context encodes it, never the reverse.",
      "",
      "Channel symbols are minted here from that coverage, one per (rung,",
      "covered symbol): a channel exists exactly where a family at a rung is",
      "able to provision a symbol, which is what coverage says. Their values",
      "are in s3, at the coordinates the platform provisions and nowhere else.",
      "",
      "Derivations are absent: that vocabulary is not yet settled.",
    ]),
  );
  for (const cov of coverage) {
    if (UNENCODED_AXES.has(cov.axis) && cov.symbols.length === 0) continue;
    const family = FAMILY_ENCODING[cov.axis];
    const contract = term("dt", `contract.${cov.axis}`, DT);
    if (family) {
      const familyIri = `ds:global.modifier_family.${family}`;
      const facts = [
        `dt:contract ${contract}`,
        // Every resolver axis admits exactly one context per permutation, so
        // exclusivity is read off the encoding rather than guessed.
        "ds:exclusive true",
        ...cov.symbols.map((s) => `dt:covers ${symbolIri(s)}`),
      ];
      out.push(`${familyIri}\n    ${facts.join(" ;\n    ")} .\n`);
      out.push(`${axisIri(cov.axis)} dt:encodes ${familyIri} .\n`);
    }
    const props = [
      "a dt:Contract",
      ...(LEVEL[cov.axis] ? [`dt:level ${LEVEL[cov.axis]}`] : []),
      "dt:provision dt:provision.selected",
      `dt:providesType ${str(PROVIDES_TYPE[cov.axis] ?? "color")}`,
    ];
    out.push(`${contract}\n    ${props.join(" ;\n    ")} .\n`);
  }

  out.push("## Channel symbols, minted from coverage\n");
  for (const ch of mintChannels(coverage)) {
    const props = [
      "a dt:TokenSymbol",
      `dt:channelOf ${symbolIri(ch.of)}`,
      `rdfs:label ${str(ch.name)}`,
    ];
    out.push(`${symbolIri(ch.name)}\n    ${props.join(" ;\n    ")} .\n`);
  }

  out.push("## Coordinates, and the contexts that encode them\n");
  for (const cov of coverage) {
    const family = FAMILY_ENCODING[cov.axis];
    if (!family) continue;
    const name = familyName(cov.axis);
    for (const ctx of [...cov.contexts.keys()].sort(cmp)) {
      const key = `${cov.axis}.${ctx}`;
      const coordinate = coordinateIri(name, ctx);
      const concept = UNENCODED_CONTEXTS.has(key)
        ? null
        : (CONTEXT_ENCODING[key] ?? ctx);
      const props = [
        "a dt:Coordinate",
        `dt:family ds:global.modifier_family.${family}`,
        // `none` is an authored point that contributes nothing, which is not
        // the same fact as a missing concept: it has no ds:Modifier to mean.
        ...(concept && ctx !== "none"
          ? [`dt:concept ds:global.modifier.${concept}`]
          : []),
      ];
      out.push(`${coordinate}\n    ${props.join(" ;\n    ")} .`);
      out.push(`${contextIri(cov.axis, ctx)} dt:encodes ${coordinate} .\n`);
    }
    const indeterminate = INDETERMINATE[cov.axis];
    if (indeterminate) {
      out.push(
        `${coordinateIri(name, "indeterminate")}\n    a dt:Coordinate ;\n` +
          `    dt:family ds:global.modifier_family.${family} ;\n` +
          `    dt:resolvesBy ${indeterminate.preference} ;\n` +
          `    dt:otherwise ${indeterminate.otherwise} .\n`,
      );
    }
  }
  out.push("");
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

// ─────────────────────────────────────────────────────────────── emit s3 ─────

interface S3Result {
  ttl: string;
  counts: {
    base: number;
    dark: number;
    absentAtDefault: string[];
    channels: ChannelResolution;
  };
}

/**
 * One routing a channel carries: the position it holds at, and the symbol whose
 * value it is. No value of its own, which is the whole of the shape: the value
 * is read by following `derivedFrom` to the target symbol and taking ITS value
 * at whatever position the consumer asks for. So the channel cannot drift from
 * the symbol it provisions, and no mode coordinate is needed to say which copy
 * of the value this row holds — there is no copy.
 */
export interface ChannelRouting {
  /** The channel symbol — `modifier.color.text`. */
  channel: string;
  /**
   * The position, as a coordinate local name: exactly the coordinate the
   * platform's own declaration selects — `anticipation.constructive`. Never a
   * product with another family.
   */
  coordinate: string;
  /** The symbol whose value this is — `color.text.constructive`. */
  derivedFrom: string;
}

export interface ChannelResolution {
  /** One row per (channel × coordinate) pair the platform provisions. */
  routings: ChannelRouting[];
  /** Channel declarations whose references reached no symbol at all. */
  unrouted: string[];
  /** Routed symbols S3 holds no value for. */
  unresolved: string[];
  /** Channels whose variable the catalogue does not declare. */
  unemitted: string[];
}

const NIL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil";
const RDF_FIRST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first";
const RDF_REST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest";
const S4_WEB = "https://dt.canonical.com/s4/web/";

/**
 * The kebab-case twin of a dotted name — the build's own naming rule, which
 * lowercases each camelCase segment's word boundary. Restated here rather than
 * imported from `catalogue.ts` on purpose: the edge from this stratum to that
 * one runs through the FILE it writes, never through its code, so nothing here
 * depends on the catalogue's producer still being a script in this package.
 */
const channelVariable = (name: string): string =>
  `--${name
    .replace(/\./g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()}`;

/** The routing the web catalogue records, per variable. */
interface Routing {
  /** variable → coordinate local name → the symbol the declaration routes to. */
  routes: Map<string, Map<string, string>>;
  /** Declarations under a coordinate whose references reach no symbol. */
  unrouted: Map<string, string[]>;
  /** Every variable the catalogue declares. */
  declared: Set<string>;
}

/**
 * Reads the routing out of the platform catalogue: for every declaration of a
 * variable under a condition that selects a coordinate, the symbol the
 * declaration's first symbol-bearing reference names. This is "one hop", the
 * walk `S4.DESIGN.md` ruling (E) describes, read as data.
 *
 * The routing is taken from the catalogue rather than from a naming rule
 * because a naming rule is wrong: `modifier.X` at coordinate C is NOT the
 * symbol `X.<last segment of C>`. Measured against the catalogue's 175 channel
 * declarations, that rule names the right symbol 102 times and the wrong one
 * 73 — every lifecycle and release position aliases the criticality ramp,
 * `caution` aliases `warning`, the surface channels are emitted at their base
 * symbol's own value under layer1 and modal — and it invents symbols the
 * platform never emits. The platform's own routing is right 175 times.
 */
function readRouting(ttl: string): Routing {
  const quads = new Parser({ baseIRI: S4_WEB }).parse(ttl);
  const first = new Map<string, string>();
  const rest = new Map<string, string>();
  const ofSymbol = new Map<string, string>();
  const declaredAt = new Map<string, string[]>();
  const under = new Map<string, string>();
  const references = new Map<string, string>();
  const selects = new Map<string, string[]>();
  const declared = new Set<string>();

  for (const q of quads) {
    const p = q.predicate.value;
    if (p === RDF_FIRST) first.set(q.subject.value, q.object.value);
    else if (p === RDF_REST) rest.set(q.subject.value, q.object.value);
    else if (p === `${DT}ofSymbol`)
      ofSymbol.set(
        q.subject.value,
        decodeURIComponent(q.object.value.slice(DT.length)),
      );
    else if (p === `${DT}declaredAt`) {
      declared.add(q.subject.value);
      const l = declaredAt.get(q.subject.value) ?? [];
      l.push(q.object.value);
      declaredAt.set(q.subject.value, l);
    } else if (p === `${DT}under`) under.set(q.subject.value, q.object.value);
    else if (p === `${DT}references`)
      references.set(q.subject.value, q.object.value);
    else if (p === `${DT}selectsCoordinate`) {
      const l = selects.get(q.subject.value) ?? [];
      l.push(
        decodeURIComponent(q.object.value.slice(`${DT}coordinate.`.length)),
      );
      selects.set(q.subject.value, l);
    }
  }

  const items = (head: string): string[] => {
    const out: string[] = [];
    let node = head;
    while (node && node !== NIL) {
      const f = first.get(node);
      if (f) out.push(f);
      const next = rest.get(node);
      if (!next) break;
      node = next;
    }
    return out;
  };
  const name = (iri: string): string =>
    iri.startsWith(S4_WEB) ? decodeURIComponent(iri.slice(S4_WEB.length)) : iri;

  const routes = new Map<string, Map<string, string>>();
  const unrouted = new Map<string, string[]>();
  for (const variable of [...declaredAt.keys()].sort()) {
    for (const decl of declaredAt.get(variable) as string[]) {
      const condition = under.get(decl);
      const coordinates = condition ? (selects.get(condition) ?? []) : [];
      if (coordinates.length === 0) continue;
      const head = references.get(decl);
      const target = (head ? items(head) : []).find((v) => ofSymbol.has(v));
      if (!target) {
        const l = unrouted.get(name(variable)) ?? [];
        l.push(coordinates.join("+"));
        unrouted.set(name(variable), l);
        continue;
      }
      const perCoordinate =
        routes.get(name(variable)) ??
        (routes.set(name(variable), new Map()).get(name(variable)) as Map<
          string,
          string
        >);
      for (const c of coordinates)
        perCoordinate.set(c, ofSymbol.get(target) as string);
    }
  }
  return { routes, unrouted, declared: new Set([...declared].map(name)) };
}

/**
 * The routings the channels carry, from the platform's own declarations. One
 * row per (channel, coordinate) — no second row per mode, because the row
 * holds no value to differ by mode, and no row at a neutral position, where
 * the channel is unset, which is exactly what a consumer's
 * `var(--modifier-color-text, var(--color-text))` says.
 *
 * The count is LINEAR in the platform's channel declarations and must stay so.
 * Nine families offer 36 coordinates between them; a row per point of their
 * product would be a graph nobody asked for, and nothing outside this function
 * would stop one being emitted. What keeps it linear is that a row carries
 * exactly the coordinate its own declaration selects.
 *
 * `held` is the symbols S3 holds a value for, and is used only to report a
 * routing whose target is missing: nothing here reads a value. Nothing is
 * invented either — a declaration whose references reach no symbol is counted
 * and reported, not guessed at; so is a channel the catalogue declares no
 * variable for.
 */
export function resolveChannels(
  channels: Channel[],
  held: Set<string>,
  catalogue: string = readFileSync(join(DATA, "s4.web.ttl"), "utf8"),
): ChannelResolution {
  const {
    routes,
    unrouted: unroutedByVariable,
    declared,
  } = readRouting(catalogue);
  const routings: ChannelRouting[] = [];
  const unrouted: string[] = [];
  const unresolved: string[] = [];
  const unemitted: string[] = [];

  for (const channel of channels) {
    const variable = channelVariable(channel.name);
    if (!declared.has(variable)) {
      unemitted.push(channel.name);
      continue;
    }
    for (const at of unroutedByVariable.get(variable) ?? [])
      unrouted.push(`${channel.name} @ ${at}`);
    const perCoordinate = routes.get(variable);
    if (!perCoordinate) continue;
    for (const coordinate of [...perCoordinate.keys()].sort(cmp)) {
      const derivedFrom = perCoordinate.get(coordinate) as string;
      if (!held.has(derivedFrom)) {
        unresolved.push(`${channel.name} @ ${coordinate} → ${derivedFrom}`);
        continue;
      }
      routings.push({ channel: channel.name, coordinate, derivedFrom });
    }
  }
  return { routings, unrouted, unresolved, unemitted };
}

function channelBlock(r: ChannelRouting): string {
  const props = [
    "a dt:ResolvedValue",
    `dt:forSymbol ${symbolIri(r.channel)}`,
    // Exactly the coordinate the declaration selects. No mode coordinate: with
    // no value on the node there is nothing for a mode to change, and the
    // routing is the same in either mode — which `resolveChannels` reads out
    // of the catalogue, where no channel declaration carries dt:alsoAt.
    `dt:coordinate ${term("dt", `coordinate.${r.coordinate}`, DT)}`,
    // No dt:resolvesTo and no dt:resolutionChain, and the shape forbids both
    // on a derived value. The value is the target symbol's own, at whatever
    // position the consumer asks for; a copy here would be free to drift.
    `dt:derivedFrom ${symbolIri(r.derivedFrom)}`,
  ];
  return `[]\n    ${props.join(" ;\n    ")} .\n`;
}

function emitS3(src: Source, resolver: Obj): S3Result {
  const base = mergeFor(src, resolver, {});
  const dark = mergeFor(src, resolver, { theme: "dark" });

  const themeFiles = new Set<string>();
  const themeContexts = ((resolver.modifiers as Obj).theme as Obj)
    .contexts as Obj;
  for (const ctx of Object.keys(themeContexts)) {
    for (const s of (themeContexts[ctx] ?? []) as Json[]) {
      if (isObj(s) && typeof s.$ref === "string") themeFiles.add(s.$ref);
    }
  }
  const themed = new Set(
    src.definitions
      .filter((d) => themeFiles.has(d.file))
      .map((d) => toSymbol(d.name)),
  );

  const symbols = [
    ...new Set(src.definitions.map((d) => toSymbol(d.name))),
  ].sort(cmp);
  const absentAtDefault: string[] = [];
  const blocks: string[] = [];
  // Which symbols S3 holds a value for. A channel routing to a symbol not in
  // here is reported, not invented — that is the whole use of the set: nothing
  // downstream reads a value out of it.
  const held = new Set<string>();
  let baseCount = 0;
  let darkCount = 0;

  for (const symbol of symbols) {
    const r = resolveSymbol(symbol, base);
    if (!r) {
      absentAtDefault.push(symbol);
      continue;
    }
    blocks.push(valueBlock(symbol, r, base, null));
    baseCount += 1;
    if (themed.has(symbol)) {
      const d = resolveSymbol(symbol, dark);
      if (d) {
        blocks.push(
          valueBlock(
            symbol,
            d,
            dark,
            coordinateIri(familyName("theme"), "dark"),
          ),
        );
        darkCount += 1;
      }
    }
    held.add(symbol);
  }

  const channels = resolveChannels(
    mintChannels(observedCoverage(src, resolver)),
    held,
  );

  const ttl = `${[
    header([
      "s3.ttl — the built graph",
      "",
      "Generated by src/populate.ts. One resolved value per symbol at the",
      "all-defaults position, and one more for symbols the theme family covers.",
      "The graph materialises the positions it chooses to write down; absence",
      "of a position asserts nothing about it.",
      "",
      "Channel symbols are the one exception to that shape, and the only symbols",
      "here with a position outside mode: a channel's whole content is the value",
      "another symbol has under an active coordinate, so a channel with no such",
      "position would be a symbol with no value anywhere.",
      "",
      "A channel's node carries NO VALUE. It names the coordinate its own",
      "platform declaration selects and the symbol it routes to, with",
      "dt:derivedFrom, and stops there: the value is that symbol's own, read at",
      "whatever position the consumer wants, so the target's dark value is the",
      "channel's dark value by construction rather than by a second copy that",
      "could drift. It carries no route either, because a route begins with the",
      "definition that won for the symbol and a channel is authored nowhere.",
      "",
      "One node per (channel × coordinate) pair, and no mode coordinate on it:",
      "with no value on the node there is nothing for a mode to change, and the",
      "routing is mode-independent — no channel declaration in the platform",
      "catalogue carries dt:alsoAt. The invariant that keeps this graph small:",
      "a derived routing carries exactly the coordinates its own declaration",
      "selects, never a product of families. 36 coordinates across 9 families",
      "would make a materialised cross-product explode; this count is linear in",
      "the platform's channel declarations and must stay so.",
      "",
      "Nothing is stated at a neutral position: there the channel is unset,",
      "which is what the platform's own fallback chains say.",
      "",
      "Not emitted, deliberately:",
      "  · values at interaction-state positions — a state has no resolver",
      "    context, so under the landed vocabulary its position cannot be stated;",
      "  · positions under a modifier family for symbols that are not channels —",
      "    materialisable on demand, and left out to keep this graph the size of",
      "    what ships.",
      "",
      "A route records whole-token hops only. Channel-level pointers inside a",
      "terminal value compose one value from several definitions rather than",
      "continuing a route; they are recorded in s1 as dt:refersTo.",
    ]),
    ...blocks,
    "## Channel routings, at the coordinates the platform provisions\n",
    ...channels.routings.map(channelBlock),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")}\n`;

  return {
    ttl,
    counts: { base: baseCount, dark: darkCount, absentAtDefault, channels },
  };
}

function valueBlock(
  symbol: string,
  r: Resolution,
  merged: Merged,
  context: string | null,
): string {
  const chain = r.chain.map((name) => {
    const file = merged.winner.get(name);
    return file ? nodeIri(file, name) : "";
  });
  if (chain.some((c) => c === "")) return "";
  const props = [
    "a dt:ResolvedValue",
    `dt:forSymbol ${symbolIri(symbol)}`,
    ...(context ? [`dt:coordinate ${context}`] : []),
    `dt:resolvesTo ${jsonLit(r.value)}`,
    `dt:resolutionChain ${list(chain)}`,
  ];
  return `[]\n    ${props.join(" ;\n    ")} .\n`;
}

// ───────────────────────────────────────────────────────────────── main ──────

/** Every name where a token replaces a group or the reverse, across all contexts. */
function shapeCollisionSurvey(
  src: Source,
  resolver: Obj,
): { names: string[]; sites: number } {
  const all = new Set<string>();
  let sites = 0;
  const modifiers = (resolver.modifiers ?? {}) as Obj;
  for (const axis of Object.keys(modifiers)) {
    const contexts = ((modifiers[axis] as Obj).contexts ?? {}) as Obj;
    for (const ctx of Object.keys(contexts)) {
      const found = mergeFor(src, resolver, { [axis]: ctx }).shapeCollisions;
      sites += found.length;
      for (const name of found) all.add(name);
    }
  }
  return { names: [...all].sort(cmp), sites };
}

/**
 * The three strata, as strings. Reads; writes nothing, so importing this
 * module cannot touch `data/`.
 */
export function populate(): {
  s1: string;
  s2: string;
  s3: S3Result;
  src: Source;
  coverage: Coverage[];
  channels: Channel[];
} {
  const src = loadSource();
  const resolver = readDoc(RESOLVER_REF);
  const coverage = observedCoverage(src, resolver);
  return {
    s1: emitS1(src, resolver),
    s2: emitS2(coverage),
    s3: emitS3(src, resolver),
    src,
    coverage,
    channels: mintChannels(coverage),
  };
}

export function main(): void {
  const { s1, s2, s3, src, coverage, channels } = populate();
  const resolver = readDoc(RESOLVER_REF);

  writeFileSync(join(DATA, "s1.ttl"), s1);
  writeFileSync(join(DATA, "s2.ttl"), s2);
  writeFileSync(join(DATA, "s3.ttl"), s3.ttl);

  const ch = s3.counts.channels;
  const collisions = shapeCollisionSurvey(src, resolver);
  console.log(
    [
      `files            ${src.files.length}`,
      `definitions      ${src.definitions.length}`,
      `symbols          ${new Set(src.definitions.map((d) => toSymbol(d.name))).size}`,
      `annotated groups ${src.groups.length}`,
      `axes             ${coverage.length}`,
      `contexts         ${coverage.reduce((n, c) => n + c.contexts.size, 0)}`,
      `channels minted  ${channels.length} (${channels.filter((c) => c.kind === "modifier").length} modifier, ${channels.filter((c) => c.kind === "surface").length} surface)`,
      `s3 base values   ${s3.counts.base}`,
      `s3 dark values   ${s3.counts.dark}`,
      `s3 channel rows  ${ch.routings.length}`,
      `s3 total         ${s3.counts.base + s3.counts.dark + ch.routings.length}`,
      `absent at default ${s3.counts.absentAtDefault.length}`,
      `token-over-group ${collisions.names.length} names, ${collisions.sites} sites`,
    ].join("\n"),
  );
  if (s3.counts.absentAtDefault.length) {
    console.log(
      `absent at the all-defaults position: ${s3.counts.absentAtDefault.join(", ")}`,
    );
  }
  // Reported rather than absorbed: a channel declaration that reaches no
  // symbol, a routed symbol S3 does not hold, and a minted channel the
  // platform declares no variable for are each a measurement, not a value to
  // invent.
  if (ch.unrouted.length)
    console.log(`channel declarations reaching no symbol: ${ch.unrouted.length}
  ${ch.unrouted.slice(0, 4).join("\n  ")}`);
  if (ch.unresolved.length)
    console.log(`channel positions whose routed symbol S3 lacks: ${ch.unresolved.length}
  ${ch.unresolved.slice(0, 4).join("\n  ")}`);
  if (ch.unemitted.length)
    console.log(
      `channels the web catalogue declares no variable for: ${ch.unemitted.join(", ")}`,
    );
  if (collisions.names.length) {
    console.log(`  e.g. ${collisions.names.slice(0, 4).join(", ")}`);
  }
}

if (import.meta.main) main();

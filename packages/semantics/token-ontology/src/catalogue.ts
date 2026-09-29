/**
 * Generates the web platform catalogue — S4 — from the build's output.
 *
 * Reads `packages/tokens/dist/*.css` and `dist/tokens.json`, and writes
 * `data/s4.web.ttl`. Output is deterministic. Then runs the six laws the
 * vocabulary asserts (dt.s4.shapes.ttl, foot) and prints a report.
 *
 * This is the script-first stand-in for ruling (H): the build is the
 * producer of this stratum, and this script reads the build's output rather
 * than the source. It exists to confront the model with data before the
 * emitter is changed to produce the catalogue natively.
 *
 * Importing this module writes nothing. Run with `bun run catalogue`.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
/** @canonical/design-tokens' build output, resolved through the package. */
const DIST = resolve(
  dirname(
    createRequire(import.meta.url).resolve(
      "@canonical/design-tokens/package.json",
    ),
  ),
  "dist",
);
const DATA = resolve(PKG, "data");

const DT = "https://dt.canonical.com/";
const BASE = `${DT}s4/web/`;

// ---------------------------------------------------------------------------
// 1. The platform's output, parsed
// ---------------------------------------------------------------------------

interface Condition {
  atRules: string[];
  selector: string;
  slug: string;
}

interface Declaration {
  variable: string;
  condition: Condition;
  value: string;
  file: string;
  line: number; // 1-based
}

/** Non-custom-property declarations the vocabulary has no term for. */
interface Foreign {
  property: string;
  file: string;
  line: number;
}

/**
 * Sanitised slug — ruling (C). Lossy on purpose: the verbatim selector lives
 * on dt-web:selector. Lowercase; strip leading `@ . :`; runs of anything else
 * become `-`; empty becomes `universal`.
 */
function slugPart(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/^[@.:]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return out || "universal";
}

interface Parsed {
  declarations: Declaration[];
  foreign: Foreign[];
  /** Lines the grammar read as neither a block, a declaration nor a comment,
   * as `file:line: text`. Empty over `dist/`, and asserted so in the tests. */
  ignored: string[];
}

/**
 * One emitted stylesheet, as declarations and foreign properties.
 *
 * The grammar is line-scoped: a declaration is one line ending in `;`, a
 * block prelude one line ending in `{`. That is a fact about the INPUT, which
 * is emitted CSS, not hand-written — measured over the build's 13 files and
 * 2,035 lines: zero declarations wrapped across lines, zero rules nested
 * inside a rule (every enclosing prelude but the innermost is an at-rule).
 * Both are asserted in catalogue.test.ts against the real `dist/`, so an
 * emitter that starts wrapping or nesting fails there rather than here.
 *
 * Until then a line the grammar cannot read is not skipped: a dropped
 * custom-property line takes its declaration, its dt:references, its L5 edge
 * and its L6 reachability edge with it, and the only tripwire would be a
 * declaration count nobody can attribute. So it throws.
 *
 * Pure and exported, taking the source rather than reading it, so the grammar
 * has tests that do not need a build.
 */
export function parseCssText(file: string, source: string): Parsed {
  const declarations: Declaration[] = [];
  const foreign: Foreign[] = [];
  const ignored: string[] = [];
  const stack: string[] = []; // enclosing block preludes, outermost first
  source.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("/*")) return;
    const open = /^([^{}]+)\{\s*$/.exec(line);
    if (open) {
      stack.push(open[1].trim());
      return;
    }
    if (line === "}") {
      stack.pop();
      return;
    }
    const decl = /^([^:]+):\s*(.+);\s*$/.exec(line);
    if (!decl) {
      if (/^--[\w-]+\s*:/.test(line))
        throw new Error(
          `${file}:${i + 1}: a custom property this grammar cannot read — "${line}". A declaration must be one line ending in ";".`,
        );
      ignored.push(`${file}:${i + 1}: ${line}`);
      return;
    }
    const [, property, value] = decl;
    if (!property.startsWith("--")) {
      foreign.push({ property, file, line: i + 1 });
      return;
    }
    const atRules = stack.slice(0, -1);
    const selector = stack[stack.length - 1] ?? "";
    const slug = [...atRules, selector].map(slugPart).join("/");
    declarations.push({
      variable: property,
      condition: { atRules, selector, slug },
      value,
      file,
      line: i + 1,
    });
  });
  return { declarations, foreign, ignored };
}

/** Every emitted stylesheet, in file order. */
export function cssFiles(): string[] {
  return readdirSync(DIST)
    .filter((f) => f.endsWith(".css"))
    .sort();
}

/** @note reads `packages/tokens/dist`. */
export function readCss(file: string): string {
  return readFileSync(join(DIST, file), "utf8");
}

function parseCss(): { declarations: Declaration[]; foreign: Foreign[] } {
  const declarations: Declaration[] = [];
  const foreign: Foreign[] = [];
  for (const file of cssFiles()) {
    const parsed = parseCssText(file, readCss(file));
    declarations.push(...parsed.declarations);
    foreign.push(...parsed.foreign);
  }
  return { declarations, foreign };
}

// ---------------------------------------------------------------------------
// 2. The build's own record of what it emitted
// ---------------------------------------------------------------------------

interface ArtifactToken {
  id: string | null;
  tier: string;
  visibility: string;
  derivation?: string;
  derivedFrom?: string;
}

function loadArtifact(): Record<string, ArtifactToken> {
  return JSON.parse(readFileSync(join(DIST, "tokens.json"), "utf8"));
}

/** The kebab twin of a camelCase legacy name — the build's own rule, inverted. */
export function kebabTwin(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

// ---------------------------------------------------------------------------
// 2a. The channel variables, and which of them are symbols
// ---------------------------------------------------------------------------

/**
 * Every channel variable the web build emits, and whether S2's coverage
 * predicts it.
 *
 * `minted` means a modifier family is observed to cover the base symbol, so
 * `populate.ts` mints a channel symbol for it and this variable is that
 * symbol's platform name. `uncovered` means the build emits the channel but no
 * family's context files rebind its base symbol — a build-versus-resolver
 * discrepancy, not a channel of anything. Those three are NOT minted (a
 * channel of nothing is not a symbol) and NOT given coverage by hand (that
 * would be either a token decision or a list of coverage inside a generator,
 * both of which "never hand-asserted" forbids). They keep the "one hop" walk
 * and are carried here so the discrepancy is a committed fact with a test
 * behind it rather than a number in a report.
 *
 * This list is one list on purpose: two lists drift apart, and the partition
 * test asserts the kinds are disjoint, that their union is exactly the channel
 * set the catalogue emits, and that `minted` is exactly what coverage derives.
 * A 29th channel, a renamed one, or a resolver change that covers one of the
 * three fails that test rather than passing silently.
 */
export const KNOWN_CHANNELS: readonly {
  variable: string;
  kind: "minted" | "uncovered";
}[] = [
  { variable: "--modifier-color-border", kind: "minted" },
  { variable: "--modifier-color-focus-ring", kind: "minted" },
  {
    variable: "--modifier-color-foreground-checkbox-unselected",
    kind: "uncovered",
  },
  { variable: "--modifier-color-foreground-ghost", kind: "minted" },
  { variable: "--modifier-color-foreground-input", kind: "minted" },
  { variable: "--modifier-color-foreground-primary", kind: "minted" },
  {
    variable: "--modifier-color-foreground-radio-unselected",
    kind: "uncovered",
  },
  { variable: "--modifier-color-foreground-secondary", kind: "minted" },
  { variable: "--modifier-color-icon", kind: "minted" },
  {
    variable: "--modifier-color-icon-on-foreground-secondary",
    kind: "uncovered",
  },
  { variable: "--modifier-color-text", kind: "minted" },
  { variable: "--modifier-color-text-on-foreground-secondary", kind: "minted" },
  { variable: "--surface-color-background", kind: "minted" },
  { variable: "--surface-color-foreground-checkbox-checkmark", kind: "minted" },
  {
    variable: "--surface-color-foreground-checkbox-unselected",
    kind: "minted",
  },
  { variable: "--surface-color-foreground-ghost", kind: "minted" },
  { variable: "--surface-color-foreground-ghost-branded", kind: "minted" },
  { variable: "--surface-color-foreground-ghost-constructive", kind: "minted" },
  { variable: "--surface-color-foreground-ghost-destructive", kind: "minted" },
  { variable: "--surface-color-foreground-input", kind: "minted" },
  { variable: "--surface-color-foreground-input-error", kind: "minted" },
  { variable: "--surface-color-foreground-input-success", kind: "minted" },
  { variable: "--surface-color-foreground-input-warning", kind: "minted" },
  { variable: "--surface-color-foreground-navigation-primary", kind: "minted" },
  { variable: "--surface-color-foreground-radio-checkmark", kind: "minted" },
  { variable: "--surface-color-foreground-radio-unselected", kind: "minted" },
  { variable: "--surface-color-foreground-switch-knob", kind: "minted" },
  { variable: "--surface-color-text", kind: "minted" },
];

/** The channel variables the build emits, by name — the shape a query needs. */
export const isChannelVariable = (name: string): boolean =>
  /^--(modifier|surface)-/.test(name);

/**
 * The channel symbol a channel variable is the platform's name for.
 *
 * The variable's tail is the kebab twin of the base symbol's dotted name, and
 * the inverse of that rule is ambiguous in general — `color-focus-ring` could
 * be `color.focus.ring` as readily as `color.focusRing`. So the inverse is not
 * computed but LOOKED UP, against the symbols S1 actually declares, and the
 * lookup is required to be unique: a tail matching no symbol or two is a
 * failure, not a guess. Measured: unique for all 28, with no kebab collision
 * among the 720 symbols.
 */
export function channelSymbol(variable: string, symbols: Set<string>): string {
  const kind = variable.startsWith("--modifier-") ? "modifier" : "surface";
  const tail = variable.slice(`--${kind}-`.length);
  const hits = [...symbols].filter(
    (s) => kebabTwin(s.replace(/\./g, "-")) === tail,
  );
  if (hits.length !== 1)
    throw new Error(
      `channel ${variable}: ${hits.length} symbols carry the kebab name "${tail}" (${hits.join(", ") || "none"})`,
    );
  return `${kind}.${hits[0]}`;
}

// ---------------------------------------------------------------------------
// 3. The algebra, for coordinates
// ---------------------------------------------------------------------------

interface Algebra {
  coordinates: Set<string>; // "mode.dark", "criticality.success", …
  byContextName: Map<string, string>; // "success" → "criticality.success"
  symbols: Set<string>; // every dt:TokenSymbol in S1
}

function loadAlgebra(): Algebra {
  const quads = new Parser({ baseIRI: `${DT}file/` }).parse(
    readFileSync(join(DATA, "s2.ttl"), "utf8"),
  );
  const coordinates = new Set<string>();
  const byContextName = new Map<string, string>();
  for (const q of quads) {
    if (
      q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
      q.object.value === `${DT}Coordinate`
    ) {
      coordinates.add(q.subject.value.slice(`${DT}coordinate.`.length));
    }
    if (q.predicate.value === `${DT}encodes`) {
      // dt:context.<axis>.<name> dt:encodes dt:coordinate.<family>.<name>
      const ctx = q.subject.value.slice(`${DT}context.`.length);
      const coord = q.object.value.slice(`${DT}coordinate.`.length);
      const name = ctx.slice(ctx.indexOf(".") + 1);
      byContextName.set(name, coord);
    }
  }
  const symbols = new Set<string>();
  for (const q of new Parser({ baseIRI: `${DT}file/` }).parse(
    readFileSync(join(DATA, "s1.ttl"), "utf8"),
  )) {
    if (
      q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
      q.object.value === `${DT}TokenSymbol`
    ) {
      symbols.add(q.subject.value.slice(DT.length));
    }
  }
  return { coordinates, byContextName, symbols };
}

/**
 * Which coordinate a condition selects. Recorded, per the vocabulary — but
 * this script has to derive it from the selector, and the derivation is
 * honest about its one judgement: the dark media query is left ABSENT.
 */
function selectsCoordinate(c: Condition, alg: Algebra): string | null {
  const s = c.selector;
  if (s === ":root" || s === "*") return null;
  if (c.atRules.some((r) => r.startsWith("@media"))) return null; // the judgement
  const surface = /^(\.surface)( \.surface)*$/.exec(s);
  if (surface) {
    const depth = s.split(" ").length;
    return alg.byContextName.get(`layer${depth}`) ?? null;
  }
  const cls = /^\.([A-Za-z]+)$/.exec(s);
  if (cls) return alg.byContextName.get(cls[1]) ?? null;
  return null;
}

// ---------------------------------------------------------------------------
// 4. The catalogue
// ---------------------------------------------------------------------------

interface VariableFacts {
  ofSymbol: string | null;
  tier: string | null;
  visibility: string | null;
  twinOf: string | null; // for the legacy names: whose facts were borrowed
}

/**
 * The variables a declaration's value names, in the order written.
 *
 * A single-line regex over one declaration's value, and it is what
 * `dt:references` is asserted from. It stays a regex because the input does
 * not need more: the value arrives from `parseCssText`, which reads one line
 * and refuses a declaration written across two, and the build emits no such
 * declaration (measured: 0 of 2,035 lines, asserted in catalogue.test.ts). A
 * multi-line walker would be code with no input to walk.
 *
 * The nesting of the `var()` chain is deliberately NOT recovered: ruling (D)
 * keeps structure inside a value in the value, and this list carries only the
 * fact a query needs — which variables are named, in what order. A fallback
 * chain therefore reads left to right, outermost first.
 */
export const references = (value: string): string[] =>
  [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);

const CHANNEL = new Set(["channel-modifier", "channel-surface"]);

export function build() {
  const { declarations, foreign } = parseCss();
  const artifact = loadArtifact();
  const alg = loadAlgebra();

  // conditions, minted once
  const conditions = new Map<string, Condition>();
  for (const d of declarations) {
    const c = conditions.get(d.condition.slug);
    if (
      c &&
      (c.selector !== d.condition.selector ||
        c.atRules.join("|") !== d.condition.atRules.join("|"))
    ) {
      throw new Error(`L2: slug collision on "${d.condition.slug}"`);
    }
    conditions.set(d.condition.slug, d.condition);
  }

  // variables, with facts from the artifact or borrowed from a twin
  const names = [...new Set(declarations.map((d) => d.variable))].sort();
  const facts = new Map<string, VariableFacts>();
  const phantom = new Map<string, string>(); // artifact ids that are not symbols
  const real = (id: string | null | undefined, name: string) => {
    if (!id) return null;
    if (alg.symbols.has(id)) return id;
    phantom.set(name, id);
    return null;
  };
  for (const name of names) {
    const t = artifact[name];
    if (t) {
      facts.set(name, {
        ofSymbol: real(t.id, name),
        tier: t.tier,
        visibility: t.visibility,
        twinOf: null,
      });
      continue;
    }
    const twinName = kebabTwin(name);
    const twin = artifact[twinName];
    facts.set(name, {
      ofSymbol: real(twin?.id, name),
      tier: twin?.tier ?? null,
      visibility: twin?.visibility ?? null,
      twinOf: twin ? twinName : null,
    });
  }

  // The channel bridge. The artifact carries no id for a channel — a channel
  // is not the platform's name for an authored token — so identity comes from
  // the graph's side: the symbol coverage minted for it. With dt:ofSymbol set,
  // a channel joins the built graph by the same key as every other variable,
  // and ruling (E)'s "one hop" walk is left to the three uncovered channels
  // and to the computed state variables, which is what it is for.
  const emittedChannels = new Set(names.filter(isChannelVariable));
  for (const { variable, kind } of KNOWN_CHANNELS) {
    if (kind !== "minted" || !emittedChannels.has(variable)) continue;
    const f = facts.get(variable) as VariableFacts;
    facts.set(variable, {
      ...f,
      ofSymbol: channelSymbol(variable, alg.symbols),
    });
  }

  // per-declaration facts
  const byVariable = new Map<string, Declaration[]>();
  for (const d of declarations) {
    const list = byVariable.get(d.variable) ?? [];
    list.push(d);
    byVariable.set(d.variable, list);
  }

  const lit = (s: string) =>
    `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  const condBlocks = [...conditions.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((c) => {
      const coord = selectsCoordinate(c, alg);
      const at = c.atRules.length
        ? `    dt-web:inAtRule ( ${c.atRules.map(lit).join(" ")} ) ;\n`
        : "";
      const sel = `    dt-web:selector ${lit(c.selector)} ;\n`;
      const sc = coord
        ? `    dt:selectsCoordinate dt:coordinate.${coord} ;\n`
        : "";
      return `<cond/${c.slug}>\n    a dt:Condition ;\n${at}${sel}${sc}`.replace(
        / ;\n$/,
        " .\n",
      );
    });

  const varBlocks = names.map((name) => {
    const f = facts.get(name)!;
    const head = [`<${name}>`, `    a dt:Variable ;`];
    // The custom-property name with its leading `--` stripped. Carried
    // because a consumer holding only the IRI cannot use the name it encodes:
    // `--color-text` is not something a command line will accept as an
    // argument at all, an option parser reads it as a flag. The stripped names
    // are unique across all 1,156 and share nothing with the symbol labels, so
    // the two label sets can be queried as one without collision.
    head.push(`    rdfs:label ${lit(name.replace(/^--/, ""))} ;`);
    if (f.ofSymbol) head.push(`    dt:ofSymbol dt:${f.ofSymbol} ;`);
    if (f.tier) head.push(`    dt:tier dt:tier.${f.tier} ;`);
    if (f.visibility)
      head.push(`    dt:visibility dt:visibility.${f.visibility} ;`);
    const decls = byVariable
      .get(name)!
      .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
      .map((d) => {
        const t = artifact[name];
        const r = references(d.value);
        const rows = [
          `        a dt:Declaration ;`,
          `        dt:under <cond/${d.condition.slug}> ;`,
          `        dt:emits ${lit(d.value)} ;`,
          `        dt:at ${lit(`${d.file}:${d.line}`)} ;`,
        ];
        if (r.length)
          rows.push(
            `        dt:references ( ${r.map((v) => `<${v}>`).join(" ")} ) ;`,
          );
        if (d.value.startsWith("light-dark("))
          rows.push(`        dt:alsoAt dt:coordinate.mode.dark ;`);
        if (t?.derivation) {
          rows.push(`        dt:derives dt:derivation.${t.derivation} ;`);
          const from = CHANNEL.has(t.derivation) ? r[0] : t.derivedFrom;
          if (from) rows.push(`        dt:computedFrom <${from}> ;`);
        }
        return `[\n${rows.join("\n").replace(/ ;$/, "")} ]`;
      });
    return `${head.join("\n")}\n    dt:declaredAt ${decls.join(" ,\n    ")} .\n`;
  });

  const header = [
    "###############################################################################",
    "# s4.web.ttl — the web platform catalogue",
    "#",
    "# Generated by src/catalogue.ts from packages/tokens/dist. NOT hand-edited.",
    "# One catalogue per platform; this is the web's. Every custom-property",
    "# declaration the build ships is a row here, verbatim, under the condition",
    "# it was emitted in.",
    "#",
    "# The bridge into the built graph is (dt:ofSymbol x position), where the",
    "# position is the condition's coordinate plus any dt:alsoAt. A variable",
    "# with no symbol reaches the graph by following dt:references — which is",
    "# now the three uncovered channels and the computed state variables, since",
    "# the 25 channels coverage predicts carry dt:ofSymbol naming their channel",
    "# symbol.",
    "#",
    "# Deliberately absent: dt:selectsCoordinate on the dark media query — whether",
    "# it selects mode.dark or mode.indeterminate is a judgement, not derivable.",
    "###############################################################################",
    "",
    "@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    `@prefix dt:   <${DT}> .`,
    `@prefix dt-web: <${DT}platform/web/> .`,
    `@base <${BASE}> .`,
    "",
  ].join("\n");

  const ttl = `${header}${condBlocks.join("\n")}\n${varBlocks.join("\n")}`;

  return {
    declarations,
    foreign,
    conditions,
    names,
    facts,
    byVariable,
    alg,
    references,
    ttl,
    phantom,
  };
}

// ---------------------------------------------------------------------------
// 5. The laws
// ---------------------------------------------------------------------------

/** The L6 buckets. Named so each is pinned separately and a shift is visible. */
export type L6Group = "delta" | "typography" | "twins" | "other";

/**
 * What the laws measured, as numbers rather than as prose.
 *
 * The report was a string, which reads well and cannot be asserted. These are
 * the same measurements in a form a test pins, so a law that starts failing
 * fails the build instead of printing a different sentence into a log.
 */
export interface Findings {
  l1: { declarations: number; files: number; foreign: string[] };
  l2: { conditions: number; slugs: number };
  l3: {
    phantoms: number;
    matched: number;
    declined: number;
    missing: number;
    noSymbol: number;
  };
  l4: { named: number; unknown: string[] };
  l5: { dangling: string[] };
  l6: { unreachable: number; total: number; groups: Record<L6Group, number> };
}

export function laws(b: ReturnType<typeof build>): {
  lines: string;
  findings: Findings;
} {
  const out: string[] = [];
  const say = (s: string) => out.push(s);

  // L1 — regeneration, as sequence equality per file (byte-level needs a serialiser)
  const byFile = new Map<string, Declaration[]>();
  for (const d of b.declarations)
    (byFile.get(d.file) ?? byFile.set(d.file, []).get(d.file)!).push(d);
  say(
    `L1 regeneration    ${b.declarations.length} declarations recorded across ${byFile.size} files; ${b.foreign.length} foreign declarations (no term): ${[...new Set(b.foreign.map((f) => f.property))].join(", ")}`,
  );

  // L2 — slug uniqueness (build() already throws on collision)
  say(
    `L2 slugs           ${b.conditions.size} conditions, ${b.conditions.size} distinct slugs`,
  );

  // L3 — bridge, against S3
  const s3 = new Parser({ baseIRI: `${DT}file/` }).parse(
    readFileSync(join(DATA, "s3.ttl"), "utf8"),
  );
  const positions = new Map<string, Set<string>>(); // symbol → set of sorted-coord keys
  const sym = new Map<string, string>(),
    coords = new Map<string, string[]>();
  for (const q of s3) {
    if (q.predicate.value === `${DT}forSymbol`)
      sym.set(q.subject.value, q.object.value.slice(DT.length));
    if (q.predicate.value === `${DT}coordinate`)
      (
        coords.get(q.subject.value) ??
        coords.set(q.subject.value, []).get(q.subject.value)!
      ).push(q.object.value.slice(`${DT}coordinate.`.length));
  }
  for (const [node, s] of sym) {
    const key = (coords.get(node) ?? []).sort().join("+");
    (positions.get(s) ?? positions.set(s, new Set()).get(s)!).add(key);
  }
  let matched = 0,
    declined = 0,
    missing = 0,
    noSymbol = 0;
  const missingSample: string[] = [];
  for (const name of b.names) {
    const f = b.facts.get(name)!;
    if (!f.ofSymbol) {
      noSymbol += b.byVariable.get(name)!.length;
      continue;
    }
    for (const d of b.byVariable.get(name)!) {
      const c = selectsCoordinate(d.condition, b.alg);
      const held = positions.get(f.ofSymbol);
      const posKeys = [
        c ?? "",
        ...(d.value.startsWith("light-dark(") ? ["mode.dark"] : []),
      ].map((k) => k);
      for (const k of posKeys) {
        if (!held) {
          missing++;
          if (missingSample.length < 3)
            missingSample.push(`${name} → ${f.ofSymbol} (symbol not in S3)`);
          continue;
        }
        if (held.has(k)) matched++;
        else if (k === "" || k === "mode.dark") {
          missing++;
          if (missingSample.length < 3)
            missingSample.push(`${name} @ ${k || "default"}`);
        } else declined++;
      }
    }
  }
  say(
    `L3 phantoms        ${b.phantom.size} variables whose artifact id is not a symbol in S1 (e.g. ${[...b.phantom.values()].slice(0, 2).join(", ")})`,
  );
  say(
    `L3 bridge          matched ${matched} · declined-by-S3 ${declined} · MISSING ${missing} · no-symbol ${noSymbol}${missingSample.length ? `\n                   missing e.g. ${missingSample.join(" ; ")}` : ""}`,
  );

  // L4 — every coordinate named exists in S2
  const named = new Set<string>();
  for (const c of b.conditions.values()) {
    const k = selectsCoordinate(c, b.alg);
    if (k) named.add(k);
  }
  named.add("mode.dark");
  const unknown = [...named].filter((k) => !b.alg.coordinates.has(k));
  say(
    `L4 coordinates     ${named.size} named, ${unknown.length} unknown to S2${unknown.length ? `: ${unknown.join(", ")}` : ""}`,
  );

  // L5 — closure
  const all = new Set(b.names);
  const dangling = new Set<string>();
  for (const d of b.declarations)
    for (const r of references(d.value)) if (!all.has(r)) dangling.add(r);
  say(
    `L5 closure         ${dangling.size} referenced variables not in the catalogue${dangling.size ? `: ${[...dangling].slice(0, 4).join(", ")}` : ""}`,
  );

  // L6 — reachability
  const reach = new Map<string, boolean>();
  const visit = (n: string, seen: Set<string>): boolean => {
    if (reach.has(n)) return reach.get(n)!;
    if (b.facts.get(n)?.ofSymbol) {
      reach.set(n, true);
      return true;
    }
    if (seen.has(n)) return false;
    seen.add(n);
    const ok = (b.byVariable.get(n) ?? []).some((d) =>
      references(d.value).some((r) => all.has(r) && visit(r, seen)),
    );
    reach.set(n, ok);
    return ok;
  };
  const unreachable = b.names.filter((n) => !visit(n, new Set()));
  // Four buckets, every one of them reported even at zero, because the count
  // that matters is per bucket: 29 unreachable is an accepted total made of two
  // known populations, and a new orphan in either is the thing to catch. A
  // single total would absorb it.
  const groups: Record<L6Group, number> = {
    delta: 0,
    typography: 0,
    twins: 0,
    other: 0,
  };
  for (const n of unreachable) {
    const g: L6Group = n.startsWith("--typography-")
      ? "typography"
      : b.facts.get(n)!.twinOf
        ? "twins"
        : n.startsWith("--delta-") || /^--(hover|active|disabled)--/.test(n)
          ? "delta"
          : "other";
    groups[g] += 1;
  }
  say(
    `L6 reachability    ${unreachable.length} of ${b.names.length} variables reach no symbol: ${Object.entries(
      groups,
    )
      .map(([g, n]) => `${g} ${n}`)
      .join(" · ")}`,
  );

  return {
    lines: out.join("\n"),
    findings: {
      l1: {
        declarations: b.declarations.length,
        files: byFile.size,
        foreign: [...new Set(b.foreign.map((f) => f.property))].sort(),
      },
      l2: { conditions: b.conditions.size, slugs: b.conditions.size },
      l3: {
        phantoms: b.phantom.size,
        matched,
        declined,
        missing,
        noSymbol,
      },
      l4: { named: named.size, unknown: unknown.sort() },
      l5: { dangling: [...dangling].sort() },
      l6: { unreachable: unreachable.length, total: b.names.length, groups },
    },
  };
}

// ---------------------------------------------------------------------------
// 6. The script
// ---------------------------------------------------------------------------

export function main(): void {
  const b = build();
  writeFileSync(join(DATA, "s4.web.ttl"), b.ttl);
  const parsed = new Parser({ baseIRI: BASE }).parse(b.ttl);
  console.log(
    `s4.web.ttl written — ${parsed.length} triples, ${b.names.length} variables, ${b.conditions.size} conditions, ${b.declarations.length} declarations`,
  );
  const channels = b.names.filter(isChannelVariable);
  const bridged = channels.filter((n) => b.facts.get(n)?.ofSymbol);
  console.log(
    `channel bridge     ${bridged.length} of ${channels.length} channel variables carry dt:ofSymbol; ${channels.length - bridged.length} uncovered, on the one-hop walk\n`,
  );
  console.log(laws(b).lines);
}

if (import.meta.main) main();

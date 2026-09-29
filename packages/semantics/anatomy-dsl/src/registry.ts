/**
 * The style-key registry.
 *
 * `definitions/style-keys.yaml` IS the roster: the style keys the DSL admits,
 * what each admits as a value, and where the roster came from — reviewed as
 * data, in one committed file. This module reads that file, checks the
 * invariants it cannot express, and projects the graph forms from it:
 * `definitions/registry.ttl`, `src/registry.generated.ts`, and the closed
 * `sh:in` of `anatomy:styleKey` plus the `valueKind` `sh:or` of
 * `definitions/shapes.ttl`.
 *
 * The roster was MEASURED — every CSS property the reference implementations
 * bind on a component selector, mapped onto a key — and the measurement now
 * lives in `canonical/design-system`, where the reference stylesheets are
 * already an input. So this module reads no CSS and this package installs no
 * component library: it reads the roster the measurement produced, and the
 * roster states its own provenance, which is rendered into `registry.ttl`'s
 * header so a reader of the graph form meets it too.
 *
 * Nothing here is imported by the published build: the outputs are committed
 * files and the diff is the check.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export const DEFINITIONS = resolve(import.meta.dirname, "..", "definitions");

export type ValueKind = "token" | "primitive" | "either";

const VALUE_KINDS: readonly ValueKind[] = ["token", "primitive", "either"];

/** Where the roster came from, stated in the roster itself. */
export interface Provenance {
  /** The roster's size, asserted against the roster's own length. */
  keys: number;
  /** The component stylesheets the measurement read. */
  stylesheets: number;
  /** The date of the measurement, `YYYY-MM-DD`. */
  measured: string;
  /** The repository the measurement lives in now. */
  measurement: string;
  /** The reference packages measured, `name@version`. */
  packages: string[];
}

interface RosterEntry {
  /** What the key admits. Stated, because it was measured. */
  valueKind: ValueKind;
  /**
   * The base namespace whose symbols the key admits, on a key that takes a
   * token; absent on a primitive key. A key that admits symbols from more
   * than one namespace states them as a list, and every one of them is
   * projected into the three spellings.
   */
  namespace?: string | string[];
  /**
   * Required on a primitive key whose reference values read a `var()` anyway
   * — the component-local counts and the assets. The exception is never
   * silent: it is emitted as the key's `rdfs:comment`.
   */
  why?: string;
}

export interface Roster {
  version: number;
  provenance: Provenance;
  placeholders: string[];
  keys: Record<string, RosterEntry>;
}

export interface RegistryKey {
  key: string;
  valueKind: ValueKind;
  /**
   * Every namespace the key admits, each in its three spellings and in the
   * order the roster states them — `N.`, `modifier.N.` and `surface.N.` for
   * the first base namespace, then the same three for the next. Empty for a
   * primitive key.
   */
  tokenNamespace: string[];
  /**
   * Why a primitive key's reference values read a `var()` anyway, from the
   * roster. Set only on such a key.
   */
  override?: string;
}

export interface Registry {
  keys: RegistryKey[];
  placeholders: string[];
  provenance: Provenance;
}

export function readRoster(): Roster {
  return parseYaml(
    readFileSync(resolve(DEFINITIONS, "style-keys.yaml"), "utf8"),
  ) as Roster;
}

/**
 * The registry, from the roster. Every rule the YAML cannot state is checked
 * here, so a roster edit that contradicts one is a thrown error at generate
 * time rather than a graph that says something nobody meant.
 */
export function buildRegistry(roster = readRoster()): Registry {
  const keys: RegistryKey[] = [];
  for (const [key, entry] of Object.entries(roster.keys)) {
    if (!/^[a-z]+(\.[A-Za-z0-9]+)+$/.test(key)) {
      throw new Error(`style key "${key}" is not a dotted path`);
    }
    if (!VALUE_KINDS.includes(entry.valueKind)) {
      throw new Error(
        `style key "${key}": valueKind must be one of ${VALUE_KINDS.join(", ")}`,
      );
    }
    // A key that admits symbols must say which, and a key that admits none
    // must not: `tokenNamespace` and `valueKind` are two readings of one
    // fact, and the graph carries both.
    const primitive = entry.valueKind === "primitive";
    if (primitive && entry.namespace !== undefined) {
      throw new Error(
        `style key "${key}" is primitive, so it admits no token namespace`,
      );
    }
    if (!primitive && entry.namespace === undefined) {
      throw new Error(
        `style key "${key}" is ${entry.valueKind}, so it owes a namespace`,
      );
    }
    // One namespace or several: a list is the same statement repeated, so
    // the two spellings are normalised to one here and nowhere else, and
    // every rule below reads the list.
    const namespaces =
      entry.namespace === undefined
        ? []
        : typeof entry.namespace === "string"
          ? [entry.namespace]
          : entry.namespace;
    if (entry.namespace !== undefined && namespaces.length === 0) {
      throw new Error(
        `style key "${key}": the namespace list is empty, so the key admits nothing`,
      );
    }
    for (const namespace of namespaces) {
      if (typeof namespace !== "string" || !namespace.endsWith(".")) {
        throw new Error(
          `style key "${key}": namespace must be a dotted prefix ending in a dot`,
        );
      }
    }
    if (new Set(namespaces).size !== namespaces.length) {
      throw new Error(`style key "${key}": a namespace is stated twice`);
    }
    if (!primitive && entry.why !== undefined) {
      throw new Error(
        `style key "${key}" takes a token, so its why has nothing to explain`,
      );
    }
    keys.push({
      key,
      valueKind: entry.valueKind,
      // A key whose namespace is N. carries N., modifier.N. and surface.N.,
      // because a channel of a symbol in N. is what the anatomy consumes
      // where the implementation reads the channel. A key that admits
      // several namespaces carries the three spellings of each, grouped by
      // namespace and in the order the roster states them.
      tokenNamespace: namespaces.flatMap((namespace) => [
        namespace,
        `modifier.${namespace}`,
        `surface.${namespace}`,
      ]),
      ...(entry.why !== undefined ? { override: entry.why } : {}),
    });
  }
  keys.sort((a, b) => a.key.localeCompare(b.key));

  // The stated size is checked against the data, so the provenance the
  // header carries cannot drift from the roster it describes.
  if (roster.provenance.keys !== keys.length) {
    throw new Error(
      `the roster states ${roster.provenance.keys} keys and holds ${keys.length}`,
    );
  }

  return {
    keys,
    placeholders: roster.placeholders,
    provenance: roster.provenance,
  };
}

/**
 * `registry.ttl`'s header, provenance included: the graph form is what a
 * consumer reads, and a vocabulary whose evidence has moved has to say where
 * it went or the next reader takes it for opinion.
 */
function header(provenance: Provenance): string {
  const packages = provenance.packages
    .map((name, index) => {
      const last = index === provenance.packages.length - 1;
      return `#   ${name}${last ? "" : ","}`;
    })
    .join("\n");
  return `###############################################################################
# registry.ttl — the style-key registry
#
# GENERATED by \`bun run generate:registry\` from definitions/style-keys.yaml,
# which is the roster. Do not edit: change the roster and regenerate.
#
# One anatomy:StyleKey individual per canonical key, and nothing on it but
# what a shape, a law or a query reads:
#
#   anatomy:valueKind      token | primitive | either. A token key admits
#                          symbols only, a primitive key admits none, an
#                          either key admits both — so an either key either
#                          consumes symbols or carries a literal, and the
#                          shapes state that disjunction.
#   anatomy:tokenNamespace the dotted prefixes whose symbols the key admits,
#                          multi-valued: N., modifier.N. and surface.N., so a
#                          channel binding is not a namespace violation. A key
#                          may admit more than one base namespace, and then it
#                          carries the three spellings of each.
#
# PROVENANCE. The roster is not designed: these ${provenance.keys} keys were measured from
# the ${provenance.stylesheets} published component stylesheets of
#
${packages}
#
# on ${provenance.measured} — every CSS property those stylesheets bind on a
# component selector, mapped onto a key — so a key exists because an
# implementation binds the property. The measurement itself lives in
# ${provenance.measurement}, which reads the reference stylesheets; this
# package reads no CSS and holds the roster the measurement produced.
#
# The roster is closed: shapes.ttl's anatomy:styleKey sh:in is projected from
# the same file, and both are diffed in CI.
###############################################################################

@prefix anatomy: <https://anatomy.canonical.com/> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
`;
}

/** `registry.ttl`, as it is committed. */
export function serialiseRegistry(registry: Registry): string {
  const lines = [header(registry.provenance)];
  for (const key of registry.keys) {
    lines.push(`anatomy:key.${key.key}`);
    lines.push("    a anatomy:StyleKey ;");
    lines.push(`    rdfs:label "${key.key}" ;`);
    lines.push(`    anatomy:valueKind "${key.valueKind}" ;`);
    if (key.tokenNamespace.length > 0) {
      lines.push(
        `    anatomy:tokenNamespace ${key.tokenNamespace
          .map((ns) => `"${ns}"`)
          .join(" , ")} ;`,
      );
    }
    if (key.override !== undefined) {
      lines.push(
        `    rdfs:comment "primitive though the reference reads a var() here: ${key.override}" ;`,
      );
    }
    // The last line closes the individual. Which CSS properties were measured
    // onto the key is not repeated here: that table is the measurement's, and
    // the measurement lives in the repository the provenance names.
    lines[lines.length - 1] =
      `${(lines.at(-1) as string).replace(/ ;$/, " .")}`;
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * The registry as TypeScript, for `src/transform.ts` — which has to know
 * whether a key takes a token to decide whether to emit `anatomy:consumes`,
 * and cannot parse Turtle at runtime without a dependency the package does
 * not need.
 */
export function serialiseRegistryModule(registry: Registry): string {
  const rows = registry.keys
    .map(
      (key) =>
        `  "${key.key}": {\n    valueKind: "${key.valueKind}",\n    tokenNamespace: [${key.tokenNamespace
          .map((ns) => `"${ns}"`)
          .join(", ")}],\n  },`,
    )
    .join("\n");
  return `/**
 * GENERATED by \`bun run generate:registry\` from definitions/style-keys.yaml.
 * Do not edit: change the roster and regenerate. The Turtle form of the same
 * facts is definitions/registry.ttl, which also carries the roster's
 * provenance, and CI diffs both.
 */

export type ValueKind = "token" | "primitive" | "either";

export interface StyleKeyEntry {
  /** What the key admits: a symbol, a primitive, or either. */
  readonly valueKind: ValueKind;
  /**
   * Dotted prefixes whose symbols the key admits, channels included. A key
   * that admits several base namespaces carries the three spellings of each.
   */
  readonly tokenNamespace: readonly string[];
}

/** Segments that mark a value as a placeholder rather than a symbol (§4.1). */
export const PLACEHOLDER_SEGMENTS: readonly string[] = [
${registry.placeholders.map((p) => `  "${p}",`).join("\n")}
];

/** One entry per canonical style key. The roster is closed. */
export const STYLE_KEYS: Record<string, StyleKeyEntry> = {
${rows}
};

/** Whether the key admits a token symbol at all. */
export function takesToken(key: string): boolean {
  const entry = STYLE_KEYS[key];
  return entry !== undefined && entry.valueKind !== "primitive";
}
`;
}

/**
 * The `sh:in` list of `anatomy:styleKey`, spliced between the markers in
 * shapes.ttl so the closed roster is generated and never hand-maintained.
 */
export const IN_BEGIN = "        # BEGIN GENERATED styleKey sh:in";
export const IN_END = "        # END GENERATED styleKey sh:in";

export function serialiseStyleKeyIn(registry: Registry): string {
  const lines = [`${IN_BEGIN} — bun run generate:shapes`, "        sh:in ("];
  for (const key of registry.keys) {
    lines.push(`            "${key.key}"`);
  }
  lines.push("        ) ;");
  lines.push(IN_END);
  return lines.join("\n");
}

export const OR_BEGIN = "    # BEGIN GENERATED valueKind sh:or";
export const OR_END = "    # END GENERATED valueKind sh:or";

/** The keys of one kind, as Turtle string literals indented for the block. */
function keyList(registry: Registry, kind: ValueKind): string[] {
  return registry.keys
    .filter((key) => key.valueKind === kind)
    .map((key) => `                    "${key.key}"`);
}

/**
 * `anatomy:valueKind` as a SHACL constraint: one `sh:or` branch per kind of
 * key, with `either` compiled to the two branches it MEANS (§4.2) rather than
 * to no constraint, so the shape states the disjunction and a transform that
 * forgot to emit `anatomy:consumes` on a symbol-valued tuple is caught.
 *
 * The symbol pattern is the value grammar's own production, and it is what
 * tells a primitive from a symbol on the value side: a primitive key whose
 * value reads as a dotted symbol is a violation, and so is an `either` key
 * that carries one and consumes nothing.
 */
export function serialiseValueKindOr(registry: Registry): string {
  const symbol = "^[a-z]+(\\\\.[A-Za-z0-9]+)+$";
  return [
    `${OR_BEGIN} — bun run generate:shapes`,
    "    sh:or (",
    "        [   # a primitive key: a literal, and nothing consumed",
    "            sh:property [",
    "                sh:path anatomy:styleKey ;",
    "                sh:in (",
    ...keyList(registry, "primitive"),
    "                ) ;",
    "            ] ;",
    "            sh:property [ sh:path anatomy:consumes ; sh:maxCount 0 ] ;",
    "            sh:property [",
    "                sh:path anatomy:styleValue ;",
    `                sh:not [ sh:pattern "${symbol}" ] ;`,
    "            ] ;",
    "        ]",
    "        [   # a token key: the symbols are consumed, always",
    "            sh:property [",
    "                sh:path anatomy:styleKey ;",
    "                sh:in (",
    ...keyList(registry, "token"),
    "                ) ;",
    "            ] ;",
    "            sh:property [ sh:path anatomy:consumes ; sh:minCount 1 ] ;",
    "        ]",
    "        [   # an either key, consuming symbols",
    "            sh:property [",
    "                sh:path anatomy:styleKey ;",
    "                sh:in (",
    ...keyList(registry, "either"),
    "                ) ;",
    "            ] ;",
    "            sh:property [ sh:path anatomy:consumes ; sh:minCount 1 ] ;",
    "        ]",
    "        [   # an either key, carrying a primitive",
    "            sh:property [",
    "                sh:path anatomy:styleKey ;",
    "                sh:in (",
    ...keyList(registry, "either"),
    "                ) ;",
    "            ] ;",
    "            sh:property [ sh:path anatomy:consumes ; sh:maxCount 0 ] ;",
    "            sh:property [",
    "                sh:path anatomy:styleValue ;",
    `                sh:not [ sh:pattern "${symbol}" ] ;`,
    "            ] ;",
    "        ]",
    "    ) ;",
    '    sh:message "A style tuple must match its key\'s valueKind: a token key consumes symbols, a primitive key carries a literal and consumes none, an either key does one or the other." ;',
    OR_END,
  ].join("\n");
}

/** Splice a generated block into a file between its markers. */
export function splice(
  source: string,
  begin: string,
  end: string,
  block: string,
): string {
  const from = source.indexOf(begin);
  const to = source.indexOf(end);
  if (from === -1 || to === -1) {
    throw new Error(`no generated block between ${begin} and ${end}`);
  }
  return source.slice(0, from) + block + source.slice(to + end.length);
}

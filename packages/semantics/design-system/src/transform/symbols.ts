/**
 * The token graph, read as data (ADR J §5.3, §8.2).
 *
 * design-system imports **no TypeScript** from `@canonical/token-ontology`: that
 * package ships raw `.ts` with an empty `dependencies` and no build, so importing a
 * module from it fails on Node with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` and
 * on Bun with a missing `n3`. What it ships that a consumer can use is its Turtle, and
 * that is all this module reads — through `import.meta.resolve`, never a path into
 * `node_modules`.
 *
 * Three strata, and the split is the law's:
 *
 *   S1  the authored symbols (720)
 *   S2  the channels coverage mints (25)          — together, the 745 the law resolves against
 *   S4  the web platform's variables              — read only by the derivation's name
 *                                                   lift and by the register's X15
 *
 * `s3.ttl` is never read. It holds resolved values at coordinates, which no law here
 * asks about, and it is the file the channel revision is still moving.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";
import { CLASSES, NAMESPACES, PREDICATES } from "../constants.js";

/** The strata this repository reads, as package-relative specifiers. */
export const STRATA = {
  s1: "@canonical/token-ontology/data/s1.ttl",
  s2: "@canonical/token-ontology/data/s2.ttl",
  s4: "@canonical/token-ontology/data/s4.web.ttl",
} as const;

const OF_SYMBOL = `${NAMESPACES.dt}ofSymbol`;
const DERIVES = `${NAMESPACES.dt}derives`;
const COMPUTED_FROM = `${NAMESPACES.dt}computedFrom`;
const DECLARED_AT = `${NAMESPACES.dt}declaredAt`;
const CHANNEL_OF = `${NAMESPACES.dt}channelOf`;
const VARIABLE_CLASS = `${NAMESPACES.dt}Variable`;

/**
 * `s4.web.ttl`'s `@base`. A variable's subject IRI is that base plus the
 * custom-property name, `--` included, so the name is read off the IRI and not off the
 * `rdfs:label` (which J-1 writes with the `--` stripped).
 */
const S4_BASE = `${NAMESPACES.dt}s4/web/`;

/**
 * The three interaction states a computed state variable can derive (§5.1 step 5d,
 * case ii). `dt:derives` also carries `channel-modifier` and others, so the roster is
 * closed here rather than read from whatever a declaration happens to say.
 */
export const STATE_DERIVATIONS: readonly string[] = [
  "hover",
  "active",
  "disabled",
];

/** Read and parse one stratum, resolved from the installed package. */
function readStratum(specifier: string) {
  const path = fileURLToPath(import.meta.resolve(specifier));
  return new Parser().parse(readFileSync(path, "utf-8"));
}

/** A symbol's dotted name from its IRI, or `null` for anything outside `dt:`. */
export function dottedName(iri: string): string | null {
  return iri.startsWith(NAMESPACES.dt) ? iri.slice(NAMESPACES.dt.length) : null;
}

/** What the law resolves against: the declared symbols, and which of them are channels. */
export interface SymbolIndex {
  /** Every `dt:TokenSymbol`'s dotted name, from S1 and S2 together. */
  names: ReadonlySet<string>;
  /** A channel's dotted name to the dotted name of the symbol it is a channel of. */
  channelOf: ReadonlyMap<string, string>;
}

/**
 * Load the symbol index from S1 and S2.
 *
 * Both strata, always: a channel is minted into S2 (AT.04), so a law run over S1 alone
 * would call every `modifier.*` and `surface.*` element unresolved and the register
 * would have to carry the whole population it exists to keep small.
 */
export function loadSymbolIndex(): SymbolIndex {
  if (symbolIndex === null) {
    symbolIndex = buildSymbolIndex();
  }
  return symbolIndex;
}

/**
 * The parse is 1 MB of Turtle and the strata are immutable for the life of the
 * process, so both loaders memoize. Without it every transform test would re-parse
 * S1 and the suite would spend seconds on a file that cannot change.
 */
let symbolIndex: SymbolIndex | null = null;
let platformVariables: Map<string, PlatformVariable> | null = null;

function buildSymbolIndex(): SymbolIndex {
  const names = new Set<string>();
  const channelOf = new Map<string, string>();
  for (const specifier of [STRATA.s1, STRATA.s2]) {
    for (const entry of readStratum(specifier)) {
      const subject = dottedName(entry.subject.value);
      if (subject === null) {
        continue;
      }
      if (
        entry.predicate.value === PREDICATES.type &&
        entry.object.value === CLASSES.tokenSymbol
      ) {
        names.add(subject);
      }
      if (entry.predicate.value === CHANNEL_OF) {
        // `dt:channelOf` is declared functional with range `dt:TokenSymbol`, so its
        // object is a `dt:` IRI by the ontology's own contract.
        channelOf.set(subject, dottedName(entry.object.value) as string);
      }
    }
  }
  return { names, channelOf };
}

/**
 * One S4 web variable, in the two shapes the derivation's name lift reads.
 *
 * `symbol` is the bridge S4 already carries (`dt:ofSymbol`), which is case (i) of
 * §5.1 step 5d and beats every rule below it. `derivation` is set on a computed state
 * variable — `dt:derives dt:derivation.hover` with a `dt:computedFrom` and no
 * `dt:ofSymbol` — which case (ii) keeps as consumed under the `hover.X` spelling
 * rather than lifting to `X`'s symbol, because a consumer regenerating the CSS could
 * not otherwise tell the resting colour at `@hover` from the hover derivation of it.
 */
export interface PlatformVariable {
  /** The custom-property name, with its leading `--`. */
  variable: string;
  /** The symbol the variable is, where S4 says so. */
  symbol?: string;
  /** `hover`, `active` or `disabled` for a computed state variable. */
  derivation?: string;
  /** The variable a computed state variable is computed from. */
  computedFrom?: string;
}

/** The variable name an S4 subject IRI names, or `null` for anything else. */
function variableName(iri: string): string | null {
  return iri.startsWith(S4_BASE) && iri.slice(S4_BASE.length).startsWith("--")
    ? iri.slice(S4_BASE.length)
    : null;
}

/**
 * Load the S4 web catalogue's variables, keyed by custom-property name.
 *
 * `dt:derives` and `dt:computedFrom` hang off the `dt:declaredAt` blank node, not off
 * the variable, so this takes two passes over the parsed quads: the first collects the
 * variables and which declaration belongs to which, the second reads the derivation
 * facts off those declarations. One pass would have to buffer the same information
 * anyway, because Turtle gives no order guarantee between a subject and its blank
 * node's contents.
 */
export function loadPlatformVariables(): Map<string, PlatformVariable> {
  if (platformVariables === null) {
    platformVariables = buildPlatformVariables();
  }
  return platformVariables;
}

function buildPlatformVariables(): Map<string, PlatformVariable> {
  const quads = readStratum(STRATA.s4);
  const variables = new Map<string, PlatformVariable>();
  const declarationOwner = new Map<string, string>();

  for (const entry of quads) {
    const name = variableName(entry.subject.value);
    if (name === null) {
      continue;
    }
    if (
      entry.predicate.value === PREDICATES.type &&
      entry.object.value === VARIABLE_CLASS
    ) {
      variables.set(name, { ...variables.get(name), variable: name });
    } else if (entry.predicate.value === OF_SYMBOL) {
      // `dt:ofSymbol` is S4's bridge to a symbol: its object is a `dt:` IRI.
      variables.set(name, {
        ...variables.get(name),
        variable: name,
        symbol: dottedName(entry.object.value) as string,
      });
    } else if (entry.predicate.value === DECLARED_AT) {
      declarationOwner.set(entry.object.value, name);
    }
  }

  // A variable has one declaration per condition it is emitted under, and `dt:derives`
  // carries more than the three interaction states — `dt:derivation.channel-modifier`
  // is on every channel variable. So the facts are gathered PER DECLARATION and folded
  // onto the variable only where the derivation is one of the three §5.1 step 5d case
  // (ii) names, which is what keeps `--modifier-color-text` from reading as a computed
  // state variable.
  const perDeclaration = new Map<
    string,
    { derivation?: string; computedFrom?: string }
  >();
  for (const entry of quads) {
    if (!declarationOwner.has(entry.subject.value)) {
      continue;
    }
    const facts = perDeclaration.get(entry.subject.value) ?? {};
    if (entry.predicate.value === DERIVES) {
      // `dt:derivation.hover` names the state; the tail of the local name is the word.
      facts.derivation = entry.object.value.split(".").pop() as string;
    } else if (entry.predicate.value === COMPUTED_FROM) {
      // `dt:computedFrom` names another variable of the same catalogue.
      facts.computedFrom = variableName(entry.object.value) as string;
    } else {
      continue;
    }
    perDeclaration.set(entry.subject.value, facts);
  }

  for (const [declaration, facts] of perDeclaration) {
    if (
      facts.derivation === undefined ||
      !STATE_DERIVATIONS.includes(facts.derivation)
    ) {
      continue;
    }
    // Every declaration's owner is a variable the first pass recorded, so the lookup
    // cannot miss. A variable carrying both `dt:ofSymbol` and a state derivation would
    // keep both here rather than being silently classified as one or the other; S4
    // emits no such variable, and `symbols.tests.ts` asserts that over the real file
    // rather than letting a branch here assume it.
    const variable = variables.get(
      declarationOwner.get(declaration) as string,
    ) as PlatformVariable;
    variable.derivation = facts.derivation;
    variable.computedFrom = facts.computedFrom;
  }

  return variables;
}

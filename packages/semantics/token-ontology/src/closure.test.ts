/**
 * Vocabulary closure: every `dt:` and `w3c-tokens:` term the generated data
 * USES must be DECLARED in `definitions/`.
 *
 * The subject is the data directory, never an allowlist of terms — a list has
 * to be maintained by hand and so rots silently, which is the exact failure
 * this guards. The check also asserts a non-zero term count, so an emptied
 * `data/` cannot make it pass vacuously.
 *
 * Vocabulary is distinguished from instances by position: a term is vocabulary
 * when it appears as a predicate, or as the object of `a` / `rdf:type`.
 * Instances — symbols, coordinates, contracts — are minted by the populator
 * and are correctly absent from `definitions/`.
 *
 * Position is read from PARSED QUADS, not from indentation. The indentation
 * heuristic this replaced was wrong in both directions: a retired term inside
 * a `[ … ]` blank node on a column-zero line was invisible to it, and an
 * object list wrapped across two lines — identical triples, valid Turtle —
 * made it report the continuation as an undeclared predicate. Both directions
 * coupled the check to formatting, and the second one invited the fix of
 * reformatting the data until the check went quiet.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";
import { describe, expect, it } from "vitest";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODELLED = /^(dt|w3c-tokens):[A-Za-z][A-Za-z0-9_.-]*$/;
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/**
 * The two namespaces this package models, longest first: `w3c-tokens:` is
 * nested inside `dt:`, so a prefix test in the other order would read every
 * `w3c-tokens:` term as a `dt:` one with slashes in its name.
 */
const NAMESPACES: readonly [string, string][] = [
  ["w3c-tokens:", "https://dt.canonical.com/w3c-tokens/"],
  ["dt:", "https://dt.canonical.com/"],
];

/** An IRI as the prefixed name the definitions are written in, or null when
 * it belongs to neither namespace (`ds:`, `rdf:`, `dt-web:`, …). */
function prefixed(iri: string): string | null {
  for (const [prefix, namespace] of NAMESPACES) {
    if (!iri.startsWith(namespace)) continue;
    const term = `${prefix}${decodeURIComponent(iri.slice(namespace.length))}`;
    return MODELLED.test(term) ? term : null;
  }
  return null;
}

function readTurtle(dir: string): string {
  const here = join(PKG, dir);
  return readdirSync(here)
    .filter((f) => f.endsWith(".ttl"))
    .map((f) => readFileSync(join(here, f), "utf8"))
    .join("\n");
}

/** Each file separately, since a base or prefix is scoped to its own file. */
function turtleFiles(dir: string): string[] {
  const here = join(PKG, dir);
  return readdirSync(here)
    .filter((f) => f.endsWith(".ttl"))
    .sort()
    .map((f) => readFileSync(join(here, f), "utf8"));
}

/**
 * Terms used as a predicate, or as the object of a type assertion.
 *
 * The Turtle is parsed and the predicates read off the quads, so position is
 * position rather than a guess about layout: a predicate inside a `[ … ]`
 * blank node, inside an RDF list, or written anywhere on any line is the same
 * quad, and re-wrapping an object list changes no quad at all. Reading
 * position rather than spelling is what keeps instances out — a symbol IRI and
 * a property IRI are indistinguishable by spelling alone.
 */
function usedVocabulary(files: string[]): Set<string> {
  const out = new Set<string>();
  for (const ttl of files) {
    for (const q of new Parser().parse(ttl)) {
      const p = prefixed(q.predicate.value);
      if (p) out.add(p);
      if (q.predicate.value === RDF_TYPE && q.object.termType === "NamedNode") {
        const o = prefixed(q.object.value);
        if (o) out.add(o);
      }
    }
  }
  return out;
}

/** Terms given a definition — anything appearing in subject position. */
function declaredVocabulary(ttl: string): Set<string> {
  const out = new Set<string>();
  for (const line of ttl.split("\n")) {
    const m =
      /^([a-z0-9-]+:[A-Za-z][A-Za-z0-9_.-]*)\s*$|^([a-z0-9-]+:[A-Za-z][A-Za-z0-9_.-]*)\s+\S/.exec(
        line.replace(/#.*$/, ""),
      );
    const term = m?.[1] ?? m?.[2];
    if (term && MODELLED.test(term)) out.add(term);
  }
  return out;
}

describe("vocabulary closure", () => {
  const declared = declaredVocabulary(readTurtle("definitions"));
  // Both directories: the generated strata, and the hand-written samples,
  // which are shipped and so are just as able to name a term nothing declares.
  const usedInData = usedVocabulary(turtleFiles("data"));
  const usedInSamples = usedVocabulary(turtleFiles("samples"));
  const used = new Set([...usedInData, ...usedInSamples]);

  it("declares a non-empty vocabulary", () => {
    // Guards against the whole check passing because a directory is empty.
    expect(declared.size).toBeGreaterThan(50);
    expect(usedInData.size).toBeGreaterThan(20);
    expect(usedInSamples.size).toBeGreaterThan(10);
  });

  it("declares every term the data and the samples use", () => {
    const undeclared = [...used].filter((t) => !declared.has(t)).sort();
    expect(undeclared).toEqual([]);
  });

  it("sees a retired term go, wherever it was written", () => {
    // dt:appliesTo was retired with J's AT.13, and this case is the
    // retirement's detector rather than a restatement of the case above: the
    // term is gone from definitions/, so re-asserting it anywhere in data/ or
    // samples/ trips both. "Wherever it was written" is now literal — the
    // check reads quads, so a one-line triple, a bracketed blank node and a
    // wrapped object list are all the same to it, and a `#` comment naming
    // the term is not a triple and correctly does not trip it. That is the
    // check a grep for the term cannot make: samples/contracts.ttl keeps the
    // comment AT.13 asked for, and a grep sees it.
    expect(declared.has("dt:appliesTo")).toBe(false);
    expect(used.has("dt:appliesTo")).toBe(false);
  });
});

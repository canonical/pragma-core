import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Parser, type Quad } from "n3";
import SHACLValidator from "rdf-validate-shacl";
import env from "rdf-validate-shacl/src/defaultEnv.js";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const DEFINITIONS = resolve(ROOT, "definitions");
const GOLDENS = resolve(ROOT, "examples", "turtle");

const quads = (path: string): Quad[] =>
  new Parser().parse(readFileSync(path, "utf8"));

/** A definition file of the linked `@canonical/token-ontology`. */
const tokenOntology = (file: string): string =>
  new URL(import.meta.resolve(`@canonical/token-ontology/definitions/${file}`))
    .pathname;

/**
 * The shapes graph: this package's shapes, unioned with the token graph's.
 *
 * `dt.shapes.ttl` is in the union because J-1 REMOVES a shape from it —
 * `dt:TokenSymbolShape`, whose only property was the retired `dt:appliesTo` —
 * and this run is the one that would notice if what remained were broken or
 * if it started firing on the symbols the goldens name.
 */
let validator: SHACLValidator;

/**
 * The data graph carries `ontology.ttl` beside the document under test, and
 * this is load-bearing rather than tidy: `sh:class` resolves subclass axioms
 * from the DATA, so `caseNode`'s `sh:class anatomy:Node` needs
 * `NamedNode rdfs:subClassOf Node` present or every switch case fails.
 * `registry.ttl` joins it so the StyleKey individuals are in the same graph
 * as the tuples that name their keys.
 */
const base: Quad[] = [
  ...quads(resolve(DEFINITIONS, "ontology.ttl")),
  ...quads(resolve(DEFINITIONS, "registry.ttl")),
];

beforeAll(() => {
  validator = new SHACLValidator(
    env.dataset([
      ...quads(resolve(DEFINITIONS, "shapes.ttl")),
      ...quads(tokenOntology("dt.shapes.ttl")),
    ]),
  );
});

async function validate(
  document: Quad[],
): Promise<{ conforms: boolean; messages: string[] }> {
  const report = await validator.validate(env.dataset([...document, ...base]));
  return {
    conforms: report.conforms,
    messages: report.results.map((result) =>
      String(
        result.message?.[0]?.value ??
          result.sourceConstraintComponent?.value ??
          "",
      ),
    ),
  };
}

const goldens = readdirSync(GOLDENS)
  .filter((f) => f.endsWith(".ttl"))
  .sort();

describe("SHACL over the goldens", () => {
  it("validates the nine goldens with zero violations", async () => {
    expect(goldens).toHaveLength(9);
    let violations = 0;
    for (const file of goldens) {
      const report = await validate(quads(resolve(GOLDENS, file)));
      expect(report.messages, file).toEqual([]);
      expect(report.conforms, file).toBe(true);
      violations += report.messages.length;
    }
    expect(violations).toBe(0);
  });

  // Each case below is a document the shapes MUST refuse. Without them a
  // shapes file that stopped targeting anything would still pass the run
  // above — which is exactly the defect the cherry-picked fix repaired.
  const rejected: [string, string][] = [
    [
      "a token-kind key that consumes nothing",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "size.min.height" ; :styleValue "dimension.400" ] ] .`,
    ],
    [
      "a key outside the registry's closed roster",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "background.color" ; :styleValue "red" ] ] .`,
    ],
    [
      "the retired slash path in the spelling",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "appearance.background" ; :styleValue "color/surface/button" ] ] .`,
    ],
    [
      "the retired optional marker in the spelling",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "appearance.background" ; :styleValue "color.surface.button?" ] ] .`,
    ],
    [
      "a consumed element that is not a dt: symbol IRI",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "typography.color" ; :styleValue "color.text" ; :consumes ( "color.text" ) ] ] .`,
    ],
    [
      "a primitive-kind key carrying a symbol",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "layout.type" ; :styleValue "color.text" ] ] .`,
    ],
    [
      "a state outside the closed vocabulary",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "layout.type" ; :styleState "wobbling" ; :styleValue "flow" ] ] .`,
    ],
    [
      "a style written as a literal rather than a tuple",
      `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle "layout.type: flow" ] .`,
    ],
  ];

  it.each(rejected)("refuses %s", async (_name, document) => {
    const report = await validate(new Parser().parse(document));
    expect(report.conforms).toBe(false);
    expect(report.messages.length).toBeGreaterThan(0);
  });

  it("admits every state the closed vocabulary holds, and nothing else", async () => {
    // The refusal above is only worth having if the eight admitted states
    // pass: a sh:in that lost a member would show up here and not there.
    const states = [
      "hover",
      "active",
      "focus",
      "disabled",
      "selected",
      "expanded",
      "indeterminate",
      "invalid",
    ];
    for (const state of states) {
      const report = await validate(
        new Parser().parse(
          `@prefix : <https://anatomy.canonical.com/> .
[] a :Specification ; :rootNode [ a :NamedNode ; :uri "global.component.x" ;
  :hasStyle [ a :Style ; :styleKey "layout.type" ; :styleState "${state}" ; :styleValue "flow" ] ] .`,
        ),
      );
      expect(report.messages, state).toEqual([]);
      expect(report.conforms, state).toBe(true);
    }
  });

  it("needs the union: dt.shapes.ttl is in the shapes graph", () => {
    // The union is not decoration. J-1 removes dt:TokenSymbolShape from
    // dt.shapes.ttl, and this is the run that would notice a shape there
    // starting to fire on the symbols the goldens consume.
    const dtShapes = quads(tokenOntology("dt.shapes.ttl"));
    expect(dtShapes.length).toBeGreaterThan(0);
    expect(
      dtShapes.some((quad) => quad.object.value.includes("shacl#NodeShape")),
    ).toBe(true);
  });
});

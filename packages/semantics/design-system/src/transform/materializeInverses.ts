import { Parser } from "n3";
import { NAMESPACES } from "../constants.js";
import type { GraphStore } from "../graph/index.js";

const OWL_INVERSE_OF = `${NAMESPACES.owl}inverseOf`;

/**
 * Parse the `owl:inverseOf` pairs declared in an ontology document.
 *
 * Returns a map from each predicate URI to its inverse predicate URI. The
 * relation is symmetric, so both directions are included (A->B and B->A),
 * letting a single forward scan of the data graph emit every reverse triple.
 *
 * @param ontologyTtl - The ontology document in Turtle syntax.
 * @returns A map of predicate URI to inverse predicate URI.
 */
export function parseInversePairs(ontologyTtl: string): Map<string, string> {
  const pairs = new Map<string, string>();
  const quads = new Parser().parse(ontologyTtl);
  for (const q of quads) {
    if (q.predicate.value === OWL_INVERSE_OF) {
      pairs.set(q.subject.value, q.object.value);
      pairs.set(q.object.value, q.subject.value);
    }
  }
  return pairs;
}

/**
 * Materialize inverse-property triples in a data graph.
 *
 * For every triple `s p o` whose predicate `p` has a declared inverse `p'`
 * (per the ontology's `owl:inverseOf`) and whose object `o` is a resource
 * (NamedNode, not a literal or blank node), add the reverse triple `o p' s` if
 * it is not already present. The pipeline does no general OWL reasoning, so
 * this makes the declared inverses (e.g. hasSubcomponent/parentComponent,
 * inheritsFrom/specializedBy) queryable in the published, self-contained graph
 * without relying on a consumer-side reasoner.
 *
 * @param store - The data graph to augment.
 * @param ontologyTtl - The ontology declaring the `owl:inverseOf` pairs.
 * @returns The number of reverse triples added.
 * @note Impure — mutates `store` by adding the materialized reverse triples.
 */
export default function materializeInverses(
  store: GraphStore,
  ontologyTtl: string,
): number {
  const inverses = parseInversePairs(ontologyTtl);
  if (inverses.size === 0) {
    return 0;
  }

  let added = 0;
  // Snapshot first: we mutate the store while iterating its forward triples.
  const quads = store.getQuads();
  for (const q of quads) {
    const inverse = inverses.get(q.predicate.value);
    if (!inverse) {
      continue;
    }
    // Only resources have inverses; skip literals and blank nodes.
    if (q.object.termType !== "NamedNode") {
      continue;
    }
    const exists = store
      .getQuadsForSubject(q.object.value)
      .some(
        (r) =>
          r.predicate.value === inverse && r.object.value === q.subject.value,
      );
    if (!exists) {
      store.addQuad(q.object.value, inverse, q.subject.value);
      added += 1;
    }
  }
  return added;
}

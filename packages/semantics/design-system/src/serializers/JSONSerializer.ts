import jsonld from "jsonld";
import { Writer } from "n3";
import type { GraphStore, PrefixMap } from "../graph/index.js";

/**
 * Options for JSON-LD serialization
 */
export interface JsonLdSerializeOptions {
  prefixes: PrefixMap;
  subject?: string;
}

/**
 * Serialize a GraphStore to JSON-LD format
 *
 * If subject is provided, returns a single document for that subject.
 * Otherwise, returns all subjects as a graph.
 */
export default async function serializeToJsonLd(
  store: GraphStore,
  options: JsonLdSerializeOptions,
): Promise<Record<string, unknown>> {
  const quads = options.subject
    ? store.getQuadsForSubject(options.subject)
    : store.getQuads();

  // Convert quads to N-Quads string format for jsonld.fromRDF
  const nquads = await quadsToNQuads(quads);

  if (!nquads.trim()) {
    // No quads found, return minimal document
    const context = options.prefixes.toRecord();
    return {
      "@context": context,
      "@id": options.subject || "",
    };
  }

  // Convert N-Quads to JSON-LD
  const jsonldDoc = await jsonld.fromRDF(nquads, {
    format: "application/n-quads",
  });

  // Build context from prefixes
  const context = options.prefixes.toRecord();

  // Frame the document to embed blank nodes inline
  if (options.subject) {
    const framed = await jsonld.frame(jsonldDoc, {
      "@context": context,
      "@id": options.subject,
      "@embed": "@always",
    });

    // Compact to use prefixed URIs
    const compacted = await jsonld.compact(framed, context);
    return compacted as Record<string, unknown>;
  }

  // Compact the full document
  const compacted = await jsonld.compact(
    { "@context": context, "@graph": jsonldDoc },
    context,
  );

  return compacted as Record<string, unknown>;
}

/**
 * Convert n3 quads to N-Quads string format
 */
function quadsToNQuads(
  quads: ReturnType<GraphStore["getQuads"]>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ format: "N-Quads" });

    for (const quad of quads) {
      writer.addQuad(quad);
    }

    writer.end((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

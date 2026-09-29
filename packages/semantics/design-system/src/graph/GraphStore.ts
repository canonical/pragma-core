import type { BlankNode, Quad } from "n3";
import { DataFactory, Store } from "n3";

const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;

/**
 * RDF Graph Store - wraps n3.Store with a simpler API
 *
 * Provides methods for adding quads using prefixed URIs (e.g., "ds:button")
 * and retrieving quads for serialization.
 */
export default class GraphStore {
  private store: Store;

  constructor() {
    this.store = new Store();
  }

  /**
   * Add a quad with a URI object
   * @param subject - Subject URI (e.g., "ds:button")
   * @param predicate - Predicate URI (e.g., "rdf:type")
   * @param object - Object URI (e.g., "ds:Component")
   */
  addQuad(subject: string, predicate: string, object: string): void {
    this.store.addQuad(
      quad(
        namedNode(subject),
        namedNode(predicate),
        namedNode(object),
        defaultGraph(),
      ),
    );
  }

  /**
   * Add a quad with a literal object
   * @param subject - Subject URI (e.g., "ds:button")
   * @param predicate - Predicate URI (e.g., "ds:name")
   * @param value - Literal string value
   */
  addLiteral(subject: string, predicate: string, value: string): void {
    this.store.addQuad(
      quad(
        namedNode(subject),
        namedNode(predicate),
        literal(value),
        defaultGraph(),
      ),
    );
  }

  /**
   * Get all quads in the store
   */
  getQuads(): Quad[] {
    return this.store.getQuads(null, null, null, null);
  }

  /**
   * Get all quads for a specific subject, including blank node quads
   * Orders quads so blank node definitions come immediately after their reference
   * This allows the n3 Writer to serialize them inline as anonymous nodes
   */
  getQuadsForSubject(subject: string): Quad[] {
    const result: Quad[] = [];
    const processedBlankNodes = new Set<string>();

    // Get direct quads for this subject
    const directQuads = this.store.getQuads(
      namedNode(subject),
      null,
      null,
      null,
    );

    // Process each quad, inserting blank node quads immediately after
    for (const q of directQuads) {
      result.push(q);

      // If object is a blank node, add its quads immediately after
      if (q.object.termType === "BlankNode") {
        this.addBlankNodeQuadsRecursive(
          q.object as BlankNode,
          result,
          processedBlankNodes,
        );
      }
    }

    return result;
  }

  /**
   * Recursively add blank node quads to result array
   */
  private addBlankNodeQuadsRecursive(
    bn: BlankNode,
    result: Quad[],
    processed: Set<string>,
  ): void {
    if (processed.has(bn.value)) return;
    processed.add(bn.value);

    const bnQuads = this.store.getQuads(bn, null, null, null);
    for (const q of bnQuads) {
      result.push(q);

      // Recursively handle nested blank nodes
      if (q.object.termType === "BlankNode") {
        this.addBlankNodeQuadsRecursive(
          q.object as BlankNode,
          result,
          processed,
        );
      }
    }
  }

  /**
   * Get all unique subject URIs in the store
   */
  getSubjects(): string[] {
    const subjects = new Set<string>();
    for (const quad of this.store) {
      subjects.add(quad.subject.value);
    }
    return Array.from(subjects);
  }

  /**
   * Get the number of quads in the store
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get the underlying n3 Store for use with serializers
   */
  getN3Store(): Store {
    return this.store;
  }

  /**
   * Remove all quads from the store
   */
  clear(): void {
    this.store = new Store();
  }

  /**
   * Create a new blank node
   */
  createBlankNode(): BlankNode {
    return blankNode();
  }

  /**
   * Add a quad with a blank node as object
   * @param subject - Subject URI
   * @param predicate - Predicate URI
   * @param blankNodeObj - Blank node object
   */
  addBlankNodeQuad(
    subject: string,
    predicate: string,
    blankNodeObj: BlankNode,
  ): void {
    this.store.addQuad(
      quad(
        namedNode(subject),
        namedNode(predicate),
        blankNodeObj,
        defaultGraph(),
      ),
    );
  }

  /**
   * Add a quad with a blank node as subject and URI object
   * @param blankNodeSubj - Blank node subject
   * @param predicate - Predicate URI
   * @param object - Object URI
   */
  addQuadFromBlankNode(
    blankNodeSubj: BlankNode,
    predicate: string,
    object: string,
  ): void {
    this.store.addQuad(
      quad(
        blankNodeSubj,
        namedNode(predicate),
        namedNode(object),
        defaultGraph(),
      ),
    );
  }

  /**
   * Add a quad with a blank node as subject and literal object
   * @param blankNodeSubj - Blank node subject
   * @param predicate - Predicate URI
   * @param value - Literal string value
   */
  addLiteralFromBlankNode(
    blankNodeSubj: BlankNode,
    predicate: string,
    value: string,
  ): void {
    this.store.addQuad(
      quad(blankNodeSubj, namedNode(predicate), literal(value), defaultGraph()),
    );
  }
}

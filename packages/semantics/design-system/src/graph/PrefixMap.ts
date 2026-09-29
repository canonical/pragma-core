/**
 * Manages RDF namespace prefixes for URI expansion and compaction
 */
export default class PrefixMap {
  private prefixes: Map<string, string> = new Map();

  /**
   * Create a PrefixMap from a JSON-LD context object
   * Extracts only namespace URI mappings (strings starting with http)
   */
  static fromContext(context: Record<string, unknown>): PrefixMap {
    const pm = new PrefixMap();
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === "string" && value.startsWith("http")) {
        pm.add(key, value);
      }
    }
    return pm;
  }

  /**
   * Add a prefix-namespace mapping
   */
  add(prefix: string, namespace: string): void {
    this.prefixes.set(prefix, namespace);
  }

  /**
   * Get the namespace for a prefix
   */
  get(prefix: string): string | undefined {
    return this.prefixes.get(prefix);
  }

  /**
   * Expand a prefixed URI (e.g., "ds:name") to full URI
   */
  expand(prefixedUri: string): string {
    const colonIndex = prefixedUri.indexOf(":");
    if (colonIndex === -1) {
      return prefixedUri;
    }

    const prefix = prefixedUri.slice(0, colonIndex);
    const localName = prefixedUri.slice(colonIndex + 1);
    const namespace = this.prefixes.get(prefix);

    if (!namespace) {
      return prefixedUri;
    }

    return namespace + localName;
  }

  /**
   * Compact a full URI to prefixed form if a matching prefix exists
   * Uses the longest matching namespace
   */
  compact(fullUri: string): string {
    let bestMatch: { prefix: string; namespace: string } | null = null;

    for (const [prefix, namespace] of this.prefixes) {
      if (fullUri.startsWith(namespace)) {
        if (!bestMatch || namespace.length > bestMatch.namespace.length) {
          bestMatch = { prefix, namespace };
        }
      }
    }

    if (!bestMatch) {
      return fullUri;
    }

    const localName = fullUri.slice(bestMatch.namespace.length);
    return `${bestMatch.prefix}:${localName}`;
  }

  /**
   * Iterate over all prefix-namespace pairs
   */
  entries(): IterableIterator<[string, string]> {
    return this.prefixes.entries();
  }

  /**
   * Convert to plain object (for n3 Writer)
   */
  toRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [prefix, namespace] of this.prefixes) {
      record[prefix] = namespace;
    }
    return record;
  }
}

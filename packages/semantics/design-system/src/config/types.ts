/**
 * Supported data providers
 */
export type Provider = "coda";

/**
 * Output format for RDF serialization
 */
export type Format = "ttl" | "json-ld";

/**
 * Atomicity determines file output granularity
 * - "class": One file per table/class
 * - "instance": One file per row/instance
 */
export type Atomicity = "class" | "instance";

/**
 * Inline table configuration for embedding related data as blank nodes
 */
export interface InlineConfig {
  /** Name of the table in extractedData.tables to embed */
  table: string;
  /** Property mappings for the blank node (column → predicate) */
  properties: Record<string, string>;
  /** Optional: class type for the blank node */
  class?: string;
}

/**
 * JSON-LD context value - can be a string or object with @id, @type
 */
export type ContextValue =
  | string
  | {
      "@id": string;
      "@type"?: string;
      "@container"?: string;
      /** Embed related data inline as blank nodes */
      "@inline"?: InlineConfig;
    };

/**
 * JSON-LD @context - maps column names directly to predicates
 */
export type JsonLdContext = {
  "@vocab"?: string;
  [columnName: string]: ContextValue | undefined;
};

/**
 * Row-level include filter for a table transform. A row is emitted only when it
 * satisfies EVERY declared condition (logical AND). Absent → every row is
 * emitted (the historical behaviour). Use this to ingest only a named,
 * non-empty subset of a large-but-mostly-stub table (e.g. Concepts, where most
 * rows carry no `content` body yet).
 */
export interface RowFilter {
  /**
   * Keep only rows whose `column` (case-insensitively, after trimming) equals
   * one of these values. The column is typically the name/title column.
   */
  nameIn?: { column: string; values: string[] };
  /**
   * Keep only rows whose named column is non-empty (a trimmed length ≥
   * `minLength`, default 1). Repeatable across columns — ALL must be non-empty.
   */
  nonEmpty?: { column: string; minLength?: number }[];
}

/**
 * Table transformation configuration
 * Note: Column names in @context ARE the Coda column names
 */
export interface TableTransform {
  "@context": JsonLdContext;
  class: string;
  uriTemplate: string;
  /**
   * Additional literal column→predicate mappings applied only when the
   * resolved RDF class matches the key (prefixed form, e.g. "ds:Layout").
   * Values in the inner map are `{ columnName: predicate }` pairs and are
   * treated as plain string literals (same semantics as a bare string in @context).
   */
  classProperties?: Record<string, Record<string, string>>;
  /**
   * Optional include-filter: emit only the rows matching every condition.
   * Absent → emit every row.
   */
  rowFilter?: RowFilter;
}

/**
 * Reference configuration for cross-table lookups
 */
export interface Reference {
  uriTemplate: string;
  keyColumn?: string;
}

/**
 * Extract command configuration
 */
export interface ExtractConfig {
  output: string;
  tables: Record<string, string>;
}

/**
 * Transform command configuration
 */
export interface TransformConfig {
  format: Format;
  outputDir: string;
  atomicity: Atomicity;
  cleanupExtract?: boolean;
  tables: Record<string, TableTransform>;
  references?: Record<string, Reference>;
}

/**
 * Full source configuration
 */
export interface Config {
  document: string;
  provider: Provider;
  extract?: ExtractConfig;
  transform?: TransformConfig;
  /**
   * Suppress the transform guard's unresolved-symbol finding, and nothing else.
   *
   * ADR J §8.2's escape hatch, for one window: the interval inside the Coda write in
   * which the authored anatomies have been written to Coda, but
   * `anatomies/register.yaml` has not yet been regenerated from them. Every other row
   * of the exit-code table still fails.
   *
   * It is a local, temporary edit and never committed — `validateConfig.tests.ts`
   * asserts that the shipped `source.json` does not set it, so the flag is red in CI
   * by construction. Defaults to false: ajv is built without `useDefaults`, so the
   * schema's `"default": false` is documentation and `undefined` is what makes it
   * false in code.
   */
  allowUnboundSymbols?: boolean;
}

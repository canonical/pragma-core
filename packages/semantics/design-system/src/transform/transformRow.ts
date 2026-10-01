import type {
  ContextValue,
  InlineConfig,
  TableTransform,
} from "../config/types.js";
import { NAMESPACES } from "../constants.js";
import type { GraphStore, PrefixMap } from "../graph/index.js";
import { buildUri } from "../graph/index.js";
import classifySubjectUri from "./classifySubjectUri.js";
import isValidReferenceUri from "./isValidReferenceUri.js";
import resolveValue from "./resolveValue.js";
import type { InlineDataMap, ReferenceMap } from "./types.js";

/**
 * Coerce a value to its literal string form.
 *
 * Values fetched in the rich format may be Coda reference objects
 * ({ id, name }) even in literal (non-reference) positions — e.g. a property's
 * `type` lookup or a tag's category label. For a literal we want the display
 * name, not `String({...})` which yields "[object Object]". Arrays are joined
 * by their element literals.
 */
function toLiteralString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(toLiteralString).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    // Coda rich objects: lookups/people carry a display `name`; link/webpage
    // values carry a `url`. Prefer name, fall back to url.
    if ("name" in value) {
      return String((value as { name: unknown }).name);
    }
    if ("url" in value) {
      return String((value as { url: unknown }).url);
    }
  }
  return String(value);
}

/**
 * Predicates whose object is a document rather than a label.
 *
 * These are the canvas columns — an anatomy, a usage narrative, a guidelines or
 * concept body — and their text is content, so every byte of it is significant.
 * `anatomies write` compares an authored file against the cell it would go in byte
 * for byte, modulo one trailing newline (see sync/planCells.sameCell), and the
 * anatomy body is YAML, where leading whitespace carries meaning. A document is
 * therefore emitted exactly as the document holds it.
 *
 * They are recognised by the predicate the table's `@context` maps the column to,
 * and not by the column's format: the extract hands the transform bare rows with no
 * column metadata, so the context mapping is the only description of a column the
 * transform has — and it is already how sync/anatomyTable finds the anatomy column.
 */
const VERBATIM_PREDICATES: ReadonlySet<string> = new Set([
  `${NAMESPACES.ds}anatomyDsl`,
  `${NAMESPACES.ds}anatomyClassic`,
  `${NAMESPACES.ds}usage`,
  `${NAMESPACES.ds}guidelines`,
  `${NAMESPACES.ds}content`,
]);

/**
 * The text a cell contributes as a literal, less the whitespace it carries from the
 * document.
 *
 * A cell typed into the document keeps whatever spaces the author left around the
 * text, and `ds:name "Timeline "` is not the name anyone looks a block up by: the
 * lookup misses, and then offers the padded name back as its own suggestion. A label
 * is the thing it names, so the padding is never significant and is dropped here, at
 * the single place a row's cell becomes a literal — plain text everywhere (`name`,
 * `summary`, a property's `default`, an inline blank node's fields), with the
 * document bodies of {@link VERBATIM_PREDICATES} left as they are.
 */
function literalText(value: unknown, predicateUri: string): string {
  const text = toLiteralString(value);
  return VERBATIM_PREDICATES.has(predicateUri) ? text : text.trim();
}

/**
 * Check if a context value indicates an object property (URI reference)
 */
function isObjectProperty(contextValue: ContextValue): boolean {
  return (
    typeof contextValue === "object" &&
    contextValue !== null &&
    "@type" in contextValue &&
    contextValue["@type"] === "@id"
  );
}

/**
 * Check if a context value has inline configuration
 */
function hasInlineConfig(
  contextValue: ContextValue,
): contextValue is { "@id": string; "@inline": InlineConfig } {
  return (
    typeof contextValue === "object" &&
    contextValue !== null &&
    "@inline" in contextValue &&
    contextValue["@inline"] !== undefined
  );
}

/**
 * Extract Coda IDs from a reference value (e.g., "#r1,#r2" or array of refs)
 */
function extractCodaIds(value: unknown): string[] {
  if (typeof value === "string") {
    // Handle CSV format: "#r1,#r2" or "content,size"
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((v) => {
      if (typeof v === "object" && v !== null && "id" in v) {
        return [String(v.id)];
      }
      return typeof v === "string" ? [v.trim()] : [];
    });
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    return [String((value as { id: string }).id)];
  }
  return [];
}

/**
 * Get the predicate URI from a context value
 */
function getPredicateUri(
  contextValue: ContextValue,
  prefixes: PrefixMap,
): string {
  if (typeof contextValue === "string") {
    return prefixes.expand(contextValue);
  }
  return prefixes.expand(contextValue["@id"]);
}

/**
 * Resolve the class for @type, supporting templates like "{type}"
 *
 * Returns null when the template cannot be resolved (e.g. empty type column).
 */
function resolveClass(
  classConfig: string,
  row: Record<string, unknown>,
  refMap: ReferenceMap,
  prefixes: PrefixMap,
): string | null {
  // Check if class is a template (contains {column})
  if (classConfig.includes("{")) {
    const columnMatch = classConfig.match(/\{(\w+)\}/);
    if (columnMatch) {
      const columnName = columnMatch[1];
      const rawValue = row[columnName];
      // The value may be a plain string or a Coda reference object
      // ({ id, name }) when fetched in the rich value format; resolveValue
      // handles both — references resolve via the reference map by id.
      if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
        const resolved = resolveValue(rawValue, refMap);
        if (typeof resolved === "string" && resolved.length > 0) {
          return prefixes.expand(resolved);
        }
      }
    }
    // Template could not be resolved — skip this row
    return null;
  }
  // Expand prefixed URI
  return prefixes.expand(classConfig);
}

/**
 * Add inline blank nodes for a property
 */
function addInlineBlankNodes(
  subjectUri: string,
  predicateUri: string,
  ids: string[],
  inlineConfig: InlineConfig,
  inlineData: Record<string, InlineDataMap>,
  store: GraphStore,
  prefixes: PrefixMap,
): void {
  const tableData = inlineData[inlineConfig.table];
  if (!tableData) return;

  for (const id of ids) {
    // Try exact match first, then lowercase for name-based lookups
    let rowData = tableData.get(id);
    if (!rowData) {
      rowData = tableData.get(id.toLowerCase());
    }
    if (!rowData) continue;

    // Create blank node
    const bn = store.createBlankNode();
    store.addBlankNodeQuad(subjectUri, predicateUri, bn);

    // Add class if specified
    if (inlineConfig.class) {
      store.addQuadFromBlankNode(
        bn,
        `${NAMESPACES.rdf}type`,
        prefixes.expand(inlineConfig.class),
      );
    }

    // Add property mappings
    for (const [column, predicate] of Object.entries(inlineConfig.properties)) {
      const value = rowData[column];
      if (value === null || value === undefined || value === "") continue;
      const propertyUri = prefixes.expand(predicate);
      store.addLiteralFromBlankNode(
        bn,
        propertyUri,
        literalText(value, propertyUri),
      );
    }
  }
}

/**
 * Warn about and skip a reference value that would serialize to invalid Turtle.
 *
 * Returns `true` when the value is a degenerate `ds:` IRI (empty local name or
 * empty dot-separated segments, e.g. `ds:global..`) and must NOT be emitted —
 * such a value comes from a blank/dangling upstream reference and would make
 * the whole `.ttl` unparseable once compacted. Returns `false` for values that
 * are safe to emit.
 */
function skipMalformedReference(
  subjectUri: string,
  predicateUri: string,
  value: string,
): boolean {
  if (isValidReferenceUri(value)) {
    return false;
  }
  console.warn(
    `Skipping malformed reference "${value}" on <${subjectUri}> ${predicateUri} — ` +
      "blank or dangling upstream reference would produce invalid Turtle.",
  );
  return true;
}

/**
 * Transform a single row into quads and add them to the store
 *
 * @param onMalformedRow - Called with the offending URI when the row is
 *   skipped because its subject URI is present but degenerate, so the caller
 *   can fail the sync at the cause (see deltaGuards.assertNoMalformedRows).
 * @param onUnclassifiableRow - Called with the row's subject URI when the row
 *   has a usable identity but its RDF class cannot be resolved (a `{type}`
 *   template over an empty or unresolvable column). Reported for the same
 *   reason: the row names a thing the document believes exists, so dropping it
 *   in silence loses a subject (see deltaGuards.assertNoUnclassifiableRows).
 * @returns The subject URI of the transformed row, or null if the row is invalid
 *          (e.g. unresolvable class template or empty/malformed URI).
 */
export default function transformRow(
  row: Record<string, unknown>,
  config: TableTransform,
  store: GraphStore,
  prefixes: PrefixMap,
  refMap: ReferenceMap,
  inlineData: Record<string, InlineDataMap> = {},
  onMalformedRow?: (uri: string) => void,
  onUnclassifiableRow?: (uri: string) => void,
): string | null {
  const rawSubjectUri = buildUri(config.uriTemplate, row);
  // An empty subject URI is a routine skip (row has no `uri`). A non-empty but
  // degenerate one (e.g. a blank row that produces `ds:global..`) would yield
  // invalid Turtle — skip it too, but warn so the upstream row is traceable,
  // mirroring the object-reference handling below, and report it to
  // `onMalformedRow` so the fail-closed guard can refuse the sync.
  const verdict = classifySubjectUri(rawSubjectUri);
  if (verdict === "empty") {
    return null;
  }
  if (verdict === "malformed") {
    console.warn(
      `Skipping row with malformed subject URI "${rawSubjectUri}" — ` +
        "blank or dangling upstream reference would produce invalid Turtle.",
    );
    onMalformedRow?.(rawSubjectUri);
    return null;
  }
  const subjectUri = prefixes.expand(rawSubjectUri);
  const classUri = resolveClass(config.class, row, refMap, prefixes);
  if (!classUri) {
    // The row identifies itself but has no resolvable class, so it cannot be
    // typed and is dropped. Warn and report: a row that got this far is
    // half-created work, and it used to disappear with no signal at all.
    console.warn(
      `Skipping row <${rawSubjectUri}> — its class template "${config.class}" ` +
        "resolved to nothing (an empty or dangling type column), so the row " +
        "cannot be typed.",
    );
    onUnclassifiableRow?.(rawSubjectUri);
    return null;
  }

  // Add rdf:type quad
  store.addQuad(subjectUri, `${NAMESPACES.rdf}type`, classUri);

  // Process each property in the context
  for (const [columnName, contextValue] of Object.entries(config["@context"])) {
    // Skip JSON-LD keywords and namespace declarations
    if (
      columnName.startsWith("@") ||
      (typeof contextValue === "string" && contextValue.startsWith("http"))
    ) {
      continue;
    }

    if (!contextValue) continue;

    const rawValue = row[columnName];

    // Skip null/undefined values (empty strings allowed for literals)
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    const predicateUri = getPredicateUri(contextValue, prefixes);

    // Handle inline blank nodes
    if (hasInlineConfig(contextValue)) {
      const ids = extractCodaIds(rawValue);
      if (ids.length > 0) {
        addInlineBlankNodes(
          subjectUri,
          predicateUri,
          ids,
          contextValue["@inline"],
          inlineData,
          store,
          prefixes,
        );
      }
      continue;
    }

    const isReference = isObjectProperty(contextValue);

    // Resolve value - only references need to go through refMap
    const resolvedValue = isReference
      ? resolveValue(rawValue, refMap)
      : rawValue;

    // Add quads for the value(s)
    if (Array.isArray(resolvedValue)) {
      for (const val of resolvedValue) {
        if (val === null || val === undefined || val === "") continue;
        if (isReference) {
          if (skipMalformedReference(subjectUri, predicateUri, String(val))) {
            continue;
          }
          store.addQuad(subjectUri, predicateUri, prefixes.expand(String(val)));
        } else {
          store.addLiteral(
            subjectUri,
            predicateUri,
            literalText(val, predicateUri),
          );
        }
      }
    } else {
      // Skip empty strings for references (they create invalid quads)
      if (isReference) {
        if (resolvedValue === "") continue;
        if (
          skipMalformedReference(
            subjectUri,
            predicateUri,
            String(resolvedValue),
          )
        ) {
          continue;
        }
        store.addQuad(
          subjectUri,
          predicateUri,
          prefixes.expand(String(resolvedValue)),
        );
      } else {
        store.addLiteral(
          subjectUri,
          predicateUri,
          literalText(resolvedValue, predicateUri),
        );
      }
    }
  }

  // Apply class-specific literal properties (classProperties in config)
  if (config.classProperties) {
    for (const [classKey, columnMap] of Object.entries(
      config.classProperties,
    )) {
      if (prefixes.expand(classKey) === classUri) {
        for (const [columnName, predicate] of Object.entries(columnMap)) {
          const rawValue = row[columnName];
          if (rawValue === null || rawValue === undefined || rawValue === "")
            continue;
          const classPropertyUri = prefixes.expand(predicate);
          store.addLiteral(
            subjectUri,
            classPropertyUri,
            literalText(rawValue, classPropertyUri),
          );
        }
      }
    }
  }

  return subjectUri;
}

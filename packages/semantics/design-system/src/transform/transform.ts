import type { TransformConfig } from "../config/types.js";
import { GraphStore, PrefixMap } from "../graph/index.js";
import type { MalformedRow } from "./deltaGuards.js";
import expectedTables from "./expectedTables.js";
import resolveReferences from "./resolveReferences.js";
import { rowPassesFilter } from "./rowFilter.js";
import transformRow from "./transformRow.js";
import type {
  InlineDataMap,
  ReferenceMap,
  TableSubjectStats,
} from "./types.js";

/**
 * Extracted data structure from the extract command
 */
interface ExtractedData {
  document: string;
  extractedAt: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

/**
 * Result of the transform operation
 */
export interface TransformResult {
  store: GraphStore;
  prefixes: PrefixMap;
  subjects: string[];
  /** Per-table row/subject counts, for the fail-closed delta guards. */
  tableStats: Record<string, TableSubjectStats>;
  /**
   * Rows dropped because their subject URI was present but degenerate, for
   * the fail-closed malformed-row guard. Empty on a healthy extract.
   */
  malformedRows: MalformedRow[];
  /**
   * Rows that carried an identity but whose RDF class could not be resolved
   * (a `{type}` class template over an empty or unresolvable column), for
   * the fail-closed guard. Such a row is half-created work, not a blank:
   * dropping it silently loses a subject the document believes exists.
   */
  unclassifiableRows: MalformedRow[];
}

/**
 * Transform extracted data into an RDF graph
 *
 * Takes the extracted table data and configuration, builds reference maps
 * for cross-table lookups, then transforms each row into quads.
 */
export default function transform(
  config: TransformConfig,
  extractedData: ExtractedData,
): TransformResult {
  // Fail closed on partial extracts: the pull sync regenerates the output
  // from scratch, so a configured table missing from the extract (expired
  // token, renamed grid, partial API response) would silently erase all of
  // its committed RDF if we skipped it.
  const missingTables = expectedTables(config).filter(
    (tableName) => !(tableName in extractedData.tables),
  );
  if (missingTables.length > 0) {
    throw new Error(
      `Extract output is missing expected table(s): ${missingTables.join(", ")}. ` +
        "All configured tables must be present - refusing to transform a partial extract.",
    );
  }

  const store = new GraphStore();
  const subjects: string[] = [];
  const tableStats: Record<string, TableSubjectStats> = {};
  const malformedRows: MalformedRow[] = [];
  const unclassifiableRows: MalformedRow[] = [];

  // Build reference maps for all reference tables
  const mergedRefMap: ReferenceMap = new Map();

  if (config.references) {
    for (const [tableName, refConfig] of Object.entries(config.references)) {
      const tableData = extractedData.tables[tableName];
      if (tableData) {
        const refMap = resolveReferences(tableData, refConfig);
        // Merge into the combined map
        for (const [key, value] of refMap) {
          mergedRefMap.set(key, value);
        }
      }
    }
  }

  // Collect all prefixes from table contexts
  const prefixes = new PrefixMap();

  // Build inline data maps for all tables (indexed by _codaId and common name columns)
  const inlineData: Record<string, InlineDataMap> = {};
  const nameColumns = ["name", "property name", "Name"];
  for (const [tableName, tableData] of Object.entries(extractedData.tables)) {
    const dataMap: InlineDataMap = new Map();
    for (const row of tableData) {
      // Index by Coda ID
      const codaId = row._codaId as string;
      if (codaId) {
        dataMap.set(codaId, row);
      }
      // Also index by common name columns for name-based lookups
      for (const col of nameColumns) {
        const nameValue = row[col];
        if (typeof nameValue === "string" && nameValue.length > 0) {
          dataMap.set(nameValue.toLowerCase(), row);
        }
      }
    }
    inlineData[tableName] = dataMap;
  }

  // Transform each configured table
  for (const [tableName, tableConfig] of Object.entries(config.tables)) {
    const tableData = extractedData.tables[tableName];
    if (!tableData) {
      // Unreachable: presence is enforced by the manifest check above. Kept
      // as a hard fail (never a silent skip) so a regression here can never
      // quietly drop a table's committed data again.
      throw new Error(`Extract output is missing expected table: ${tableName}`);
    }

    // Extract prefixes from this table's context
    const tablePrefixes = PrefixMap.fromContext(
      tableConfig["@context"] as Record<string, unknown>,
    );
    for (const [prefix, namespace] of tablePrefixes.entries()) {
      prefixes.add(prefix, namespace);
    }

    // Transform each row, skipping any excluded by an optional include-filter
    // (e.g. Concepts narrowed to the named, non-empty subset).
    const { rowFilter } = tableConfig;
    let subjectCount = 0;
    let filteredCount = 0;
    for (const row of tableData) {
      if (rowFilter && !rowPassesFilter(row, rowFilter)) {
        filteredCount += 1;
        continue;
      }
      const subjectUri = transformRow(
        row,
        tableConfig,
        store,
        prefixes,
        mergedRefMap,
        inlineData,
        (uri) => malformedRows.push({ table: tableName, uri }),
        (uri) => unclassifiableRows.push({ table: tableName, uri }),
      );
      if (subjectUri !== null) {
        subjects.push(subjectUri);
        subjectCount += 1;
      }
    }
    tableStats[tableName] = {
      rows: tableData.length,
      filtered: filteredCount,
      eligible: tableData.length - filteredCount,
      subjects: subjectCount,
    };
  }

  return {
    store,
    prefixes,
    subjects,
    tableStats,
    malformedRows,
    unclassifiableRows,
  };
}

import type { TransformConfig } from "../config/types.js";

/**
 * Derive the manifest of table names the transform expects the extract to
 * provide: every configured output table, every reference table, and every
 * table embedded through an `@inline` context entry.
 *
 * The pull sync regenerates `data/` from scratch on every run, so a table
 * that silently vanishes from the extract (expired token, renamed grid,
 * partial API response) would otherwise erase all of its committed RDF.
 * The transform checks this manifest and hard-fails on any missing table
 * instead of skipping it (see transform()).
 *
 * @param config - The transform section of the source configuration.
 * @returns Sorted, de-duplicated table names that must be present in the extract.
 */
export default function expectedTables(config: TransformConfig): string[] {
  const names = new Set<string>(Object.keys(config.tables));

  // Tables embedded as blank nodes via `"@inline": { "table": ... }`.
  for (const tableConfig of Object.values(config.tables)) {
    for (const contextValue of Object.values(tableConfig["@context"])) {
      if (typeof contextValue === "object" && contextValue["@inline"]) {
        names.add(contextValue["@inline"].table);
      }
    }
  }

  for (const tableName of Object.keys(config.references ?? {})) {
    names.add(tableName);
  }

  return [...names].sort();
}

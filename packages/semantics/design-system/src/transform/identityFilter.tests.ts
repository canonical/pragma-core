import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TableTransform } from "../config/types.js";

/**
 * The shipped source configuration, read as data.
 *
 * These are assertions about `source.json` itself rather than about a
 * function, because the invariant they protect lives in the configuration: a
 * table that does not declare which column carries its identity is a latent
 * sync outage, and the only moment to catch that is when the table is added.
 */
const source = JSON.parse(readFileSync("source.json", "utf8")) as {
  transform: { tables: Record<string, TableTransform> };
};

const tables = Object.entries(source.transform.tables);

describe("every transformed table declares an identity filter", () => {
  it("configures at least one table (the fixture is real, not empty)", () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it.each(tables)(
    "%s excludes rows whose identity column is empty",
    (_tableName, config) => {
      // A row with no name is not a thing yet. Excluding it declaratively —
      // rather than letting it reach the transform, produce a degenerate IRI
      // such as `ds:apps_support..` and trip the fail-closed malformed-row
      // guard — is what keeps an accidental blank row from halting the sync.
      // Coda creates such a row whenever someone clicks into the last one.
      expect(config.rowFilter?.nonEmpty ?? []).not.toHaveLength(0);
    },
  );

  it.each(tables)(
    "%s filters on a column it actually maps or identifies by",
    (_tableName, config) => {
      // Guards against the typo that would be invisible and catastrophic: a
      // filter naming a column that does not exist excludes EVERY row, and a
      // table with no eligible rows produces no subjects at all.
      const mapped = new Set<string>();
      for (const key of Object.keys(config["@context"])) {
        if (!key.startsWith("@")) mapped.add(key);
      }
      for (const columnMap of Object.values(config.classProperties ?? {})) {
        for (const column of Object.keys(columnMap)) mapped.add(column);
      }
      for (const match of config.uriTemplate.matchAll(/\{(\w+)\}/g)) {
        mapped.add(match[1]);
      }

      const filtered = (config.rowFilter?.nonEmpty ?? []).map(
        (entry) => entry.column,
      );
      for (const column of filtered) {
        expect(mapped).toContain(column);
      }
    },
  );
});

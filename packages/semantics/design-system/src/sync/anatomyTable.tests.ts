import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import readAnatomyTable, {
  ANATOMY_PREDICATE,
  SOURCE_CONFIG_PATH,
  TABLE,
  UnconfiguredAnatomiesError,
} from "./anatomyTable.js";

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "anatomy-table-test-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

/** A `source.json`-shaped fixture, valid against the schema by default. */
async function source(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const path = join(base, `source-${Object.keys(overrides).join("-")}.json`);
  await writeFile(
    path,
    JSON.stringify({
      document: "doc",
      provider: "coda",
      extract: {
        output: "tmp/extract.json",
        tables: { uiBlocks: "grid-blocks" },
      },
      transform: {
        format: "ttl",
        outputDir: "data/",
        atomicity: "instance",
        tables: {
          uiBlocks: {
            "@context": {
              ds: "https://ds.canonical.com/",
              name: "ds:name",
              anatomy_dsl: "ds:anatomyDsl",
              tier: { "@id": "ds:tier", "@type": "@id" },
            },
            class: "{type}",
            uriTemplate: "{uri}",
          },
        },
      },
      ...overrides,
    }),
    "utf-8",
  );
  return path;
}

describe("readAnatomyTable", () => {
  it("reads the committed source.json, which is the only configuration there is", () => {
    // No second file: the root configuration already says all four things, and the
    // write plans against the same table id the pull sync reads by construction.
    const table = readAnatomyTable();

    expect(table.document).toBe("NyzE_TLZDh");
    expect(table.table).toBe("grid-20dWwIHYhx");
    expect(table.anatomyColumn).toBe("anatomy_dsl");
    expect(table.uriColumn).toBe("uri");
    expect(table.path).toBe(SOURCE_CONFIG_PATH);
    expect(SOURCE_CONFIG_PATH).toBe("source.json");
  });

  it("takes the anatomy column from the context rather than from a constant", async () => {
    // The column is whatever the transform maps to the anatomy predicate. Renaming
    // the column in the document is one edit to `source.json`, not two.
    const path = await source({
      transform: {
        format: "ttl",
        outputDir: "data/",
        atomicity: "instance",
        tables: {
          uiBlocks: {
            "@context": { anatomy_yaml: ANATOMY_PREDICATE },
            class: "{type}",
            uriTemplate: "{name}",
          },
        },
      },
    });

    const table = readAnatomyTable(path);
    expect(table.anatomyColumn).toBe("anatomy_yaml");
    // And the identity column is the one the subject is built from, whatever it is.
    expect(table.uriColumn).toBe("name");
  });

  it("refuses when extract declares no such table, naming the file and the section", async () => {
    const path = await source({
      extract: { output: "tmp/extract.json", tables: { tiers: "grid-t" } },
    });

    try {
      readAnatomyTable(path);
      expect.unreachable("readAnatomyTable must refuse an undeclared table");
    } catch (error) {
      // Typed, so a caller can print the sentence without matching on a string.
      expect(error).toBeInstanceOf(UnconfiguredAnatomiesError);
      expect((error as Error).message).toContain(
        "declares no `uiBlocks` table under `extract.tables`",
      );
      expect((error as Error).message).toContain(path);
    }
  });

  it("refuses an empty table id, which says the same thing", async () => {
    const path = await source({
      extract: { output: "tmp/extract.json", tables: { uiBlocks: "" } },
    });
    expect(() => readAnatomyTable(path)).toThrow(
      "declares no `uiBlocks` table under `extract.tables`",
    );
  });

  it("refuses when the transform declares no such table", async () => {
    const path = await source({
      transform: {
        format: "ttl",
        outputDir: "data/",
        atomicity: "instance",
        tables: {},
      },
    });
    expect(() => readAnatomyTable(path)).toThrow(
      "declares no `uiBlocks` table under `transform.tables`",
    );
  });

  it("refuses when the context maps no column to the anatomy predicate", async () => {
    // Nothing then says which cell carries an anatomy, and guessing at a column
    // name is how a write lands in the wrong cell.
    const path = await source({
      transform: {
        format: "ttl",
        outputDir: "data/",
        atomicity: "instance",
        tables: {
          uiBlocks: {
            "@context": { name: "ds:name" },
            class: "{type}",
            uriTemplate: "{uri}",
          },
        },
      },
    });
    expect(() => readAnatomyTable(path)).toThrow(
      "maps no `uiBlocks` column to `ds:anatomyDsl`",
    );
  });

  it("refuses a uriTemplate that names anything but one column", async () => {
    for (const uriTemplate of ["ds:tag.{tier}.{name}", "ds:fixed"]) {
      const path = join(base, "source-template.json");
      await writeFile(
        path,
        JSON.stringify({
          document: "doc",
          provider: "coda",
          extract: {
            output: "tmp/extract.json",
            tables: { uiBlocks: "grid-blocks" },
          },
          transform: {
            format: "ttl",
            outputDir: "data/",
            atomicity: "instance",
            tables: {
              uiBlocks: {
                "@context": { anatomy_dsl: ANATOMY_PREDICATE },
                class: "{type}",
                uriTemplate,
              },
            },
          },
        }),
        "utf-8",
      );
      expect(() => readAnatomyTable(path)).toThrow(
        "A row can only be matched to a file by one",
      );
    }
  });

  it("lets a configuration that does not validate through as itself", async () => {
    // A defect in the checkout rather than a fact about the document: the schema's
    // own message is more use here than a sentence of ours wrapped around it.
    const path = join(base, "invalid.json");
    await writeFile(path, JSON.stringify({ provider: "coda" }), "utf-8");
    expect(() => readAnatomyTable(path)).toThrow("Invalid config");
  });

  it("names the table and the predicate it looks for", () => {
    expect(TABLE).toBe("uiBlocks");
    expect(ANATOMY_PREDICATE).toBe("ds:anatomyDsl");
  });
});

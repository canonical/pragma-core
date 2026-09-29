/**
 * Where the anatomies live in the Coda document, read from `source.json`.
 *
 * There is no second configuration file. `source.json` is the root configuration
 * every other command reads, and it already says all four things the write needs: the
 * document id, the `uiBlocks` table's grid id under `extract.tables`, the column that
 * carries the anatomy — the `@context` key mapped to `ds:anatomyDsl` in
 * `transform.tables.uiBlocks` — and the column a row's own URI is built from, which is
 * the placeholder in that table's `uriTemplate`. A file of its own would have been a
 * second place for the same facts to be wrong in.
 *
 * Reading it through `validateConfig`, as `cli.ts` and `sync` do, is the point: the
 * write plans against the same table the pull sync reads, by construction. The two
 * refusals are named against the real file, because "source.json declares no
 * `uiBlocks` table under `extract.tables`" is a sentence a reader can act on and a
 * 404 from an API call three layers down is not.
 */
import { readFileSync } from "node:fs";
import { validateConfig } from "../config/index.js";

/** The root configuration, relative to the repository root. */
export const SOURCE_CONFIG_PATH = "source.json";

/** The table the anatomies are rows of, as `source.json` keys it. */
export const TABLE = "uiBlocks";

/** The predicate the anatomy column is mapped to in the transform's context. */
export const ANATOMY_PREDICATE = "ds:anatomyDsl";

/** What the configuration says about where an anatomy goes. */
export interface AnatomyTable {
  /** The document id — `NyzE_TLZDh`, without the `_d` prefix the URL carries. */
  document: string;
  /** The `uiBlocks` grid id. */
  table: string;
  /** The column that carries the anatomy, by display name. */
  anatomyColumn: string;
  /** The column a row's URI is built from, by display name. */
  uriColumn: string;
  /** Where this came from, for a refusal to name. */
  path: string;
}

/**
 * The configuration does not say where the anatomies live.
 *
 * A typed refusal rather than a message, so a caller can print the sentence without
 * matching on a string, and so a reader can tell "the configuration is incomplete"
 * from "the API is down".
 */
export class UnconfiguredAnatomiesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnconfiguredAnatomiesError";
  }
}

/** The `@context` key mapped to `ds:anatomyDsl`, or the refusal naming its absence. */
function anatomyColumnOf(
  context: Record<string, unknown>,
  path: string,
): string {
  // A bare string value is a literal mapping, which is what the anatomy is. An
  // object value is a reference or a set, and a reference cannot be the cell whose
  // text this write sends.
  for (const [column, predicate] of Object.entries(context)) {
    if (predicate === ANATOMY_PREDICATE) {
      return column;
    }
  }
  throw new UnconfiguredAnatomiesError(
    `${path} maps no \`${TABLE}\` column to \`${ANATOMY_PREDICATE}\`, so nothing says which cell carries an anatomy.`,
  );
}

/**
 * The single column a `uriTemplate` names.
 *
 * `"{uri}"` names the `uri` column: the template is how the transform builds a row's
 * subject, so its placeholder is the column that identifies the row — the same column
 * this write matches an authored file by, which is what makes the match the one
 * `data/` was written with.
 */
function uriColumnOf(template: string, path: string): string {
  const placeholders = [...template.matchAll(/\{([^{}]+)\}/g)].map(
    (match) => match[1],
  );
  if (placeholders.length !== 1) {
    throw new UnconfiguredAnatomiesError(
      `${path} builds a \`${TABLE}\` subject from ${JSON.stringify(template)}, which names ${placeholders.length} columns. A row can only be matched to a file by one.`,
    );
  }
  return placeholders[0];
}

/**
 * Read where the anatomies live.
 *
 * @throws UnconfiguredAnatomiesError when the configuration does not say.
 * @throws if the file is missing or does not validate — that is a defect in the
 *   checkout, not a fact about the document.
 * @note Impure — reads the file system.
 */
export default function readAnatomyTable(
  path: string = SOURCE_CONFIG_PATH,
): AnatomyTable {
  const config = validateConfig(JSON.parse(readFileSync(path, "utf-8")));

  const table = config.extract?.tables?.[TABLE] ?? "";
  if (table === "") {
    throw new UnconfiguredAnatomiesError(
      `${path} declares no \`${TABLE}\` table under \`extract.tables\`, so there is nowhere to write. The id is a grid id, \`grid-…\`, from the table's URL in the document.`,
    );
  }

  const transform = config.transform?.tables?.[TABLE];
  if (transform === undefined) {
    throw new UnconfiguredAnatomiesError(
      `${path} declares no \`${TABLE}\` table under \`transform.tables\`, so nothing says which column carries an anatomy.`,
    );
  }

  return {
    document: config.document,
    table,
    anatomyColumn: anatomyColumnOf(transform["@context"], path),
    uriColumn: uriColumnOf(transform.uriTemplate, path),
    path,
  };
}

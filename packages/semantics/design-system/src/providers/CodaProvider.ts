import type { components } from "./CodaProvider.types.generated.js";
import { detectSmartChips, type SmartChip } from "./detectSmartChips.js";

/**
 * The API host for this workspace.
 *
 * **Not `coda.io`.** The document this repository is the projection of lives in a
 * workspace served from `docs.superhuman.com`, and the two hosts do not answer for
 * the same state: a read against `coda.io` returns a stale view of this workspace,
 * and a write against it is accepted with a 202 and never applies — the worst of the
 * two failure modes, because nothing reports it. So every call goes to the workspace
 * host, reads included, and the constant is exported so a test can assert that.
 */
export const CODA_API_BASE = "https://docs.superhuman.com/apis/v1";

/** Attempts a transient failure gets, reads and writes alike. */
const MAX_ATTEMPTS = 5;

/**
 * Rows per read page.
 *
 * Declared rather than left to the API's default, so a read of a 260-row table is a
 * known number of calls: the write path paces itself between pages, and pacing over
 * an unknown page count is pacing over nothing.
 */
export const READ_PAGE_SIZE = 100;

/**
 * Delay between read pages, in milliseconds.
 *
 * **Assumed, not sourced.** No read rate limit is recorded anywhere in this
 * repository — the only rate-limit notes are on writes (`sync.ts` and
 * `src/sync/constants.ts`) — so it ships at `THROTTLE_MS`'s 1,100 ms as a ceiling.
 * With the retry below, a 429's `Retry-After` is the real signal and this is margin.
 */
export const READ_DELAY_MS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The backoff a transient failure gets: `Retry-After` when given, else exponential. */
function backoff(response: Response, attempt: number): Promise<void> {
  const retryAfter = Number(response.headers.get("retry-after") ?? "0");
  return delay(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
}

// Re-export generated types for external use
export type CodaTable = components["schemas"]["Table"];
export type CodaTableReference = components["schemas"]["TableReference"];
export type CodaTableList = components["schemas"]["TableList"];
export type CodaRow = components["schemas"]["Row"];
export type CodaRowList = components["schemas"]["RowList"];
export type CodaColumn = components["schemas"]["Column"];
export type CodaColumnList = components["schemas"]["ColumnList"];
export type CodaCellValue = components["schemas"]["CellValue"];

/**
 * What a row PUT answers: the queued mutation's id, and the row's.
 *
 * The `requestId` is the only handle on a write after it has been accepted — Coda
 * applies a mutation asynchronously, so a 202 says "queued" and nothing more — and
 * `getMutationStatus` is what turns it into an answer.
 *
 * @see https://coda.io/developers/apis/v1#operation/updateRow
 */
export type RowUpdateResult = components["schemas"]["RowUpdateResult"];

/**
 * What `GET /mutationStatus/{requestId}` answers.
 *
 * `completed` is the whole point: it separates "the document has not caught up yet"
 * from "the document applied the mutation and the cell still does not say what was
 * written", which are the same silence from the write's side.
 *
 * @see https://coda.io/developers/apis/v1#operation/getMutationStatus
 */
export type MutationStatus = components["schemas"]["MutationStatus"];

// Simplified types for this provider's API
export interface TableMetadata {
  id: string;
  name: string;
}

export interface ColumnMetadata {
  id: string;
  name: string;
  type: string;
  format: components["schemas"]["ColumnFormat"];
}

export interface TableRow {
  _codaId: string;
  [key: string]: unknown;
}

/**
 * Coda API client for fetching document tables and data
 */
export default class CodaProvider {
  private apiKey: string;

  /**
   * The environment variable the read-only path uses. `extract`, `list` and `sync`
   * read it, and it is the credential CI holds.
   */
  static readonly READ_KEY_VAR = "CODA_API_KEY";

  /**
   * The environment variable the write path uses.
   *
   * A second, write-scoped token, restricted to the one document. `anatomies write`
   * and `anatomies restore` use it for **their reads as well as their writes** and
   * never touch `CODA_API_KEY`: that keeps the CI credential un-escalatable by any
   * code path that happens to reach for a write, and it is simpler than two keys
   * inside one command.
   */
  static readonly WRITE_KEY_VAR = "CODA_WRITE_TOKEN";

  /**
   * @param keyVar - which environment variable holds the credential. Defaults to the
   *   read-only one, so every existing caller is unchanged; the write path passes
   *   `CodaProvider.WRITE_KEY_VAR` explicitly and can therefore never run on the CI
   *   credential by accident.
   */
  constructor(keyVar: string = CodaProvider.READ_KEY_VAR) {
    const apiKey = process.env[keyVar];
    if (!apiKey) {
      throw new Error(`${keyVar} environment variable is required`);
    }
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Issue a GET against the Coda API, retrying a transient failure.
   *
   * Reads are the half that scales — the write path reads the whole `uiBlocks` table
   * before it plans and again after it applies — and they used to be the unprotected
   * half: `mutateWithAuth` had a five-attempt backoff and this had none. It now has
   * the same one, on the same two conditions and honouring the same `Retry-After`,
   * which is what makes the read delay a margin rather than a guess.
   */
  private async fetchWithAuth<T>(url: string): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        method: "GET",
        headers: this.headers,
      });
      if (response.ok) {
        return response.json() as Promise<T>;
      }
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS) {
        await backoff(response, attempt);
        continue;
      }
      throw new Error(
        `Coda API error: ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Normalize a single cell value from Coda's `rich` value format.
   *
   * We fetch rows with `valueFormat=rich` because it is the only format that
   * carries the stable Coda `rowId` for lookup references (the `simple`/
   * `simpleWithArrays` formats collapse lookups to their display name, which is
   * unstable). `rich` has two side effects this method undoes:
   *
   *  1. Whole-value scalar canvas cells are wrapped in a Markdown code fence
   *     (e.g. ```Button``` or a ```yaml block). We strip the fence ONLY when the
   *     entire value is a single fenced block, never touching fences embedded
   *     inside Markdown bodies (usage/guidelines may legitimately contain them).
   *  2. Lookup references arrive as schema.org `StructuredValue` objects
   *     ({ name, rowId, ... }). We rewrite them to the `{ id, name }` shape that
   *     resolveValue/extractCodaIds key on by `id` — so references resolve by the
   *     stable Coda rowId rather than the display name.
   */
  private normalizeCellValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => this.normalizeCellValue(v));
    }
    if (this.isStructuredValue(value)) {
      return { id: value.rowId, name: value.name };
    }
    if (typeof value === "string") {
      const unfenced = this.stripWholeValueFence(value);
      // Extraction seam: detect Coda smart chips (internal row links) embedded
      // in Markdown bodies, then hand the string to the chip handler. The
      // handler is currently a no-op (returns the string verbatim) — the seam
      // exists so future work (rewriting coda.io chip URLs to ds: URIs and/or
      // extracting them as explicit reference edges) plugs in here without
      // re-plumbing. See pragma-adrs M.01 OQ9.
      return this.handleSmartChips(unfenced, detectSmartChips(unfenced));
    }
    return value;
  }

  /**
   * Handle Coda smart chips found in a Markdown string value.
   *
   * NO-OP for now: returns the value unchanged. The detected chips are passed
   * in so a future implementation can rewrite their coda.io URLs to ds: URIs
   * (resolved by rowId) or emit reference edges, keeping the published graph
   * Coda-agnostic. Until then, chips survive verbatim as Markdown links — no
   * loss, and strictly better than the `simple` format which drops the link.
   */
  private handleSmartChips(value: string, _chips: SmartChip[]): string {
    return value;
  }

  /**
   * A Coda `rich` lookup reference: schema.org StructuredValue with a row id.
   */
  private isStructuredValue(
    value: unknown,
  ): value is { name: string; rowId: string } {
    return (
      typeof value === "object" &&
      value !== null &&
      "@type" in value &&
      (value as { "@type": unknown })["@type"] === "StructuredValue" &&
      "rowId" in value &&
      "name" in value
    );
  }

  /**
   * Strip a Markdown code fence only when it wraps the ENTIRE value.
   * `` ```Button``` `` -> `Button`; a whole ```yaml ... ``` block -> its body.
   * Leaves fences that are part of a larger Markdown body untouched.
   */
  private stripWholeValueFence(value: string): string {
    const trimmed = value.trim();
    // Multi-line fenced block: ```lang\n...\n```. The text after the opening
    // fence on its own line is an info string ONLY when it reads as a language
    // tag; a canvas cell written through the API comes back with its first line
    // glued to the fence (```---\nnode: …), and that first line is content.
    const block = trimmed.match(/^```(?:[A-Za-z][\w+.-]*)?\n([\s\S]*?)\n?```$/);
    if (block) {
      return block[1];
    }
    const glued = trimmed.match(/^```([^\n`][^\n]*\n[\s\S]*?)\n?```$/);
    if (glued) {
      return glued[1];
    }
    // Single-line inline fence: ```text```
    const inline = trimmed.match(/^```([^`\n]*)```$/);
    if (inline) {
      return inline[1];
    }
    return value;
  }

  /**
   * List all tables in a document
   *
   * @see https://coda.io/developers/apis/v1#tag/Tables/operation/listTables
   */
  async listTables(documentId: string): Promise<TableMetadata[]> {
    const tables: TableMetadata[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${CODA_API_BASE}/docs/${documentId}/tables`);
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await this.fetchWithAuth<CodaTableList>(url.toString());

      for (const table of response.items) {
        tables.push({
          id: table.id,
          name: table.name,
        });
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return tables;
  }

  /**
   * Fetch all rows from a table
   *
   * @see https://coda.io/developers/apis/v1#tag/Rows/operation/listRows
   */
  async fetchTable(documentId: string, tableId: string): Promise<TableRow[]> {
    const rows: TableRow[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(
        `${CODA_API_BASE}/docs/${documentId}/tables/${tableId}/rows`,
      );
      url.searchParams.set("useColumnNames", "true");
      // `rich` is the only format that carries stable lookup rowIds; see
      // normalizeCellValue for the side effects we undo.
      url.searchParams.set("valueFormat", "rich");
      // An explicit page size, so a read is a known number of calls rather than
      // whatever the API happens to default to.
      url.searchParams.set("limit", String(READ_PAGE_SIZE));
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      // A delay between pages, not before the first: a single-page read pays nothing.
      if (pageToken) {
        await delay(READ_DELAY_MS);
      }

      const response = await this.fetchWithAuth<CodaRowList>(url.toString());

      for (const row of response.items) {
        const normalizedRow: TableRow = { _codaId: row.id };

        for (const [key, value] of Object.entries(row.values)) {
          // Coda API prefixes column names with "c-" when using useColumnNames=true.
          // Strip this prefix to get clean column names matching the display names.
          const normalizedKey = key.startsWith("c-") ? key.slice(2) : key;
          normalizedRow[normalizedKey] = this.normalizeCellValue(value);
        }

        rows.push(normalizedRow);
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return rows;
  }

  /**
   * Fetch column metadata for a table
   *
   * @see https://coda.io/developers/apis/v1#tag/Columns/operation/listColumns
   */
  async fetchTableColumns(
    documentId: string,
    tableId: string,
  ): Promise<ColumnMetadata[]> {
    const columns: ColumnMetadata[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(
        `${CODA_API_BASE}/docs/${documentId}/tables/${tableId}/columns`,
      );
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await this.fetchWithAuth<CodaColumnList>(url.toString());

      for (const col of response.items) {
        columns.push({
          id: col.id,
          name: col.name,
          type: col.format.type,
          format: col.format,
        });
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return columns;
  }

  /**
   * Issue a non-GET (mutating) request to the Coda API.
   *
   * @param url - the request URL
   * @param method - the HTTP method
   * @param body - the JSON request body
   * @returns the parsed JSON response
   * @throws if the API responds non-2xx
   * @note Impure — performs a mutating network call against Coda.
   */
  private async mutateWithAuth<T>(
    url: string,
    method: "POST" | "PUT" | "DELETE",
    body: unknown,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: JSON.stringify(body),
      });
      if (response.ok) {
        return response.json() as Promise<T>;
      }
      // Retry transient failures with exponential backoff: 429 (rate limit) and
      // 5xx (Coda gateway timeouts/errors), honouring Retry-After when present.
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS) {
        await backoff(response, attempt);
        continue;
      }
      const detail = await response.text();
      throw new Error(
        `Coda API ${method} error: ${response.status} ${response.statusText} — ${detail}`,
      );
    }
  }

  /**
   * Build the cell-edit list for a uiBlocks row. Cells are keyed by **column id**
   * (writing by display name silently no-ops). Lookup columns (`tier`, `type`)
   * must carry the referenced option's **row-id**, not its display string (the
   * string is accepted with a 202 but does not change the cell).
   *
   * @param cells - column-id → value pairs (value = text, or an option row-id for lookups)
   * @returns the Coda `cells` payload
   */
  private buildCells(
    cells: Record<string, string>,
  ): Array<{ column: string; value: string }> {
    return Object.entries(cells).map(([column, value]) => ({ column, value }));
  }

  /**
   * Create a row in a table.
   *
   * @param documentId - the doc id
   * @param tableId - the table id
   * @param cells - column-id → value pairs for the new row (lookup values are option row-ids)
   * @returns the upsert acknowledgement
   * @note Impure — writes to Coda.
   * @see https://coda.io/developers/apis/v1#operation/upsertRows
   */
  async createRow(
    documentId: string,
    tableId: string,
    cells: Record<string, string>,
  ): Promise<unknown> {
    const url = `${CODA_API_BASE}/docs/${documentId}/tables/${tableId}/rows`;
    return this.mutateWithAuth(url, "POST", {
      rows: [{ cells: this.buildCells(cells) }],
    });
  }

  /**
   * Update an existing row by id.
   *
   * @param documentId - the doc id
   * @param tableId - the table id
   * @param rowId - the row to update
   * @param cells - column-id → value pairs to set (lookup values are option row-ids)
   * @returns the update acknowledgement
   * @note Impure — writes to Coda.
   * @see https://coda.io/developers/apis/v1#operation/updateRow
   */
  async updateRow(
    documentId: string,
    tableId: string,
    rowId: string,
    cells: Record<string, string>,
  ): Promise<RowUpdateResult> {
    const url = `${CODA_API_BASE}/docs/${documentId}/tables/${tableId}/rows/${rowId}`;
    return this.mutateWithAuth<RowUpdateResult>(url, "PUT", {
      row: { cells: this.buildCells(cells) },
    });
  }

  /**
   * Whether a queued mutation has been applied yet.
   *
   * A write is accepted with a 202 and a `requestId`, and the document applies it
   * afterwards; this is the only way to tell that it HAS. It is a read — same host,
   * same credential, same retry — so the answer to "is the document still catching
   * up?" cannot itself be lost to a 429.
   *
   * @param requestId - the `requestId` a mutating call returned
   * @see https://coda.io/developers/apis/v1#operation/getMutationStatus
   */
  async getMutationStatus(requestId: string): Promise<MutationStatus> {
    return this.fetchWithAuth<MutationStatus>(
      `${CODA_API_BASE}/mutationStatus/${requestId}`,
    );
  }

  /**
   * Delete rows by id.
   *
   * @param documentId - the doc id
   * @param tableId - the table id
   * @param rowIds - the rows to delete
   * @returns the delete acknowledgement
   * @note Impure — irreversibly deletes Coda rows.
   * @see https://coda.io/developers/apis/v1#operation/deleteRows
   */
  async deleteRows(
    documentId: string,
    tableId: string,
    rowIds: string[],
  ): Promise<unknown> {
    const url = `${CODA_API_BASE}/docs/${documentId}/tables/${tableId}/rows`;
    return this.mutateWithAuth(url, "DELETE", { rowIds });
  }
}

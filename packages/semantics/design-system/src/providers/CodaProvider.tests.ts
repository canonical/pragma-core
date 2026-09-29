import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodaProvider, { CODA_API_BASE } from "./CodaProvider.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("CodaProvider", () => {
  const apiKey = "test-api-key";
  let provider: CodaProvider;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CODA_API_KEY;
    process.env.CODA_API_KEY = apiKey;
    provider = new CodaProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env.CODA_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  describe("listTables", () => {
    it("should fetch and return table metadata", async () => {
      const mockResponse = {
        items: [
          {
            id: "grid-abc123",
            name: "Components",
            displayColumn: { id: "c-1", name: "Name" },
          },
          {
            id: "grid-def456",
            name: "Tiers",
            displayColumn: { id: "c-2", name: "Name" },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const tables = await provider.listTables("dNyzE_TLZDh");

      expect(mockFetch).toHaveBeenCalledWith(
        `${CODA_API_BASE}/docs/dNyzE_TLZDh/tables`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        }),
      );

      expect(tables).toEqual([
        { id: "grid-abc123", name: "Components" },
        { id: "grid-def456", name: "Tiers" },
      ]);
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(provider.listTables("dNyzE_TLZDh")).rejects.toThrow(
        "Coda API error: 401 Unauthorized",
      );
    });

    it("should handle pagination", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: "grid-1", name: "Table1", displayColumn: null }],
            nextPageToken: "token123",
          }),
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: "grid-2", name: "Table2", displayColumn: null }],
          }),
      });

      const tables = await provider.listTables("doc123");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(tables).toHaveLength(2);
      expect(tables[1].id).toBe("grid-2");
    });
  });

  describe("fetchTable", () => {
    it("should fetch all rows from a table", async () => {
      const mockResponse = {
        items: [
          {
            id: "i-row1",
            values: {
              "c-Name": "Button",
              "c-Description": "A clickable button",
              "c-Version": "1.0.0",
            },
          },
          {
            id: "i-row2",
            values: {
              "c-Name": "Modal",
              "c-Description": "A dialog overlay",
              "c-Version": "2.0.0",
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const rows = await provider.fetchTable("dNyzE_TLZDh", "grid-abc123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `${CODA_API_BASE}/docs/dNyzE_TLZDh/tables/grid-abc123/rows`,
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        }),
      );

      expect(rows).toEqual([
        {
          _codaId: "i-row1",
          Name: "Button",
          Description: "A clickable button",
          Version: "1.0.0",
        },
        {
          _codaId: "i-row2",
          Name: "Modal",
          Description: "A dialog overlay",
          Version: "2.0.0",
        },
      ]);
    });

    it("should handle pagination for large tables", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: "i-row1", values: { "c-Name": "Item1" } }],
            nextPageToken: "page2token",
          }),
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: "i-row2", values: { "c-Name": "Item2" } }],
          }),
      });

      const rows = await provider.fetchTable("doc123", "grid-abc");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(rows).toHaveLength(2);
    });

    it("should normalize column names (strip c- prefix)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "i-row1",
                values: {
                  "c-MyColumn": "value1",
                  "c-Another Column": "value2",
                },
              },
            ],
          }),
      });

      const rows = await provider.fetchTable("doc", "grid");

      expect(rows[0]).toEqual({
        _codaId: "i-row1",
        MyColumn: "value1",
        "Another Column": "value2",
      });
    });

    it("should request the rich value format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      await provider.fetchTable("doc", "grid");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("valueFormat=rich"),
        expect.anything(),
      );
    });
  });

  describe("rich value normalization", () => {
    const structuredValue = (name: string, rowId: string) => ({
      "@context": "http://schema.org/",
      "@type": "StructuredValue",
      additionalType: "row",
      name,
      rowId,
      tableId: "grid-other",
    });

    async function fetchSingleRow(values: Record<string, unknown>) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [{ id: "i-row1", values }] }),
      });
      const rows = await provider.fetchTable("doc", "grid");
      return rows[0];
    }

    it("rewrites a lookup StructuredValue to { id, name } keyed on rowId", async () => {
      const row = await fetchSingleRow({
        "c-tier": structuredValue("Global", "i-tier-global"),
      });

      expect(row.tier).toEqual({ id: "i-tier-global", name: "Global" });
    });

    it("rewrites an array of StructuredValues (e.g. change_log, tags)", async () => {
      const row = await fetchSingleRow({
        "c-tags_documentation_stage": [
          structuredValue("needs:documentation", "i-Ahu4jNQ5IC"),
          structuredValue("needs:review", "i-Yb7Nbo-qve"),
        ],
      });

      expect(row.tags_documentation_stage).toEqual([
        { id: "i-Ahu4jNQ5IC", name: "needs:documentation" },
        { id: "i-Yb7Nbo-qve", name: "needs:review" },
      ]);
    });

    it("strips an inline whole-value code fence (e.g. ```Button```)", async () => {
      const row = await fetchSingleRow({ "c-name": "```Button```" });

      expect(row.name).toBe("Button");
    });

    it("strips a whole-value fenced block (e.g. a ```yaml ... ``` anatomy)", async () => {
      const yaml = "node:\n  uri: global.component.button";
      const row = await fetchSingleRow({
        "c-anatomy_dsl": `\`\`\`yaml\n${yaml}\n\`\`\``,
      });

      expect(row.anatomy_dsl).toBe(yaml);
    });

    it("keeps a first line glued to the opening fence, which is content and not a language tag", async () => {
      // A canvas cell written through the API comes back as ```---\n…\n```: the
      // document marker is the anatomy's first line, not an info string.
      const yaml = "---\nnode:\n  uri: global.component.button\n";
      const row = await fetchSingleRow({
        "c-anatomy_dsl": `\`\`\`${yaml}\`\`\``,
      });

      expect(row.anatomy_dsl).toBe(
        "---\nnode:\n  uri: global.component.button",
      );
    });

    it("leaves code fences inside a markdown body untouched", async () => {
      const usage =
        "### Usage\n\nDo this:\n\n```ts\nconst x = 1;\n```\n\nDone.";
      const row = await fetchSingleRow({ "c-usage": usage });

      expect(row.usage).toBe(usage);
    });

    it("leaves plain strings and the Figma URL untouched", async () => {
      const url = "https://www.figma.com/design/abc/File?node-id=1-2";
      const row = await fetchSingleRow({ "c-figma_link": url });

      expect(row.figma_link).toBe(url);
    });

    it("leaves smart-chip markdown verbatim (handler is a no-op seam)", async () => {
      const summary =
        "An [Accordion.Item](https://coda.io/d/_dNyzE_TLZDh#_tugrid-20dWwIHYhx/_rui-OEp6lXTfz2) opens independently.";
      const row = await fetchSingleRow({ "c-summary": summary });

      expect(row.summary).toBe(summary);
    });
  });

  describe("fetchTableColumns", () => {
    it("should fetch column metadata for a table", async () => {
      const textFormat = { type: "text", isArray: false };
      const lookupFormat = { type: "lookup", isArray: false };

      const mockResponse = {
        items: [
          { id: "c-Name", name: "Name", format: textFormat },
          { id: "c-Version", name: "Version", format: textFormat },
          { id: "c-Tier", name: "Tier", format: lookupFormat },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const columns = await provider.fetchTableColumns("doc", "grid");

      expect(columns).toEqual([
        { id: "c-Name", name: "Name", type: "text", format: textFormat },
        { id: "c-Version", name: "Version", type: "text", format: textFormat },
        { id: "c-Tier", name: "Tier", type: "lookup", format: lookupFormat },
      ]);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchTable = vi.fn();

vi.mock("../providers", () => ({
  CodaProvider: class MockCodaProvider {
    fetchTable = mockFetchTable;
  },
}));

describe("extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw if extract config is missing", async () => {
    const extract = (await import("./extract.js")).default;

    await expect(
      extract({ document: "doc", provider: "coda" }),
    ).rejects.toThrow("Extract config section is required");
  });

  it("should propagate provider errors", async () => {
    mockFetchTable.mockRejectedValueOnce(new Error("API Error"));

    const extract = (await import("./extract.js")).default;

    await expect(
      extract({
        document: "doc",
        provider: "coda",
        extract: {
          tables: { test: "table-123" },
          output: "/tmp/test-output.json",
        },
      }),
    ).rejects.toThrow("API Error");
  });
});

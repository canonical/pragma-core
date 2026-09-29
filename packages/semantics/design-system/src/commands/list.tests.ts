import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListTables = vi.fn();

vi.mock("../providers", () => ({
  CodaProvider: class MockCodaProvider {
    listTables = mockListTables;
  },
}));

describe("list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should propagate provider errors", async () => {
    mockListTables.mockRejectedValueOnce(new Error("API Error"));

    const list = (await import("./list.js")).default;

    await expect(list({ document: "doc", provider: "coda" })).rejects.toThrow(
      "API Error",
    );
  });
});

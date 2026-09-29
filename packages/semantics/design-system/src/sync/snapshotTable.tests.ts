import { writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableRow } from "../providers/index.js";
import snapshotTable from "./snapshotTable.js";

vi.mock("node:fs/promises");

const ROWS: TableRow[] = [{ _codaId: "i-1", name: "Text" }];

describe("snapshotTable", () => {
  beforeEach(() => {
    vi.mocked(writeFile).mockReset();
  });

  it("writes the rows as pretty JSON and returns the path", async () => {
    vi.mocked(writeFile).mockResolvedValue();
    const path = await snapshotTable(ROWS, "snap.json");

    expect(path).toBe("snap.json");
    expect(writeFile).toHaveBeenCalledWith(
      "snap.json",
      JSON.stringify(ROWS, null, 2),
      "utf-8",
    );
  });

  it("propagates a write failure so the caller aborts the run", async () => {
    vi.mocked(writeFile).mockRejectedValue(new Error("disk full"));
    await expect(snapshotTable(ROWS, "snap.json")).rejects.toThrow("disk full");
  });
});

import { describe, expect, it } from "vitest";
import type { TableRow } from "../providers/index.js";
import toLiveEntries from "./toLiveEntries.js";

describe("toLiveEntries", () => {
  it("extracts name and lookup display names for in-scope rows", () => {
    const rows: TableRow[] = [
      {
        _codaId: "i-1",
        name: "TextInput",
        tier: { id: "i-tier", name: "Global/Form" },
        type: { id: "i-type", name: "Component" },
      },
    ];

    const entries = toLiveEntries(rows, ["Global/Form"]);

    expect(entries).toEqual([
      {
        rowId: "i-1",
        name: "TextInput",
        tier: "Global/Form",
        type: "Component",
      },
    ]);
  });

  it("skips rows whose tier is out of scope", () => {
    const rows: TableRow[] = [
      {
        _codaId: "i-1",
        name: "X",
        tier: { id: "t", name: "Apps/Launchpad" },
        type: { id: "y", name: "Component" },
      },
    ];
    expect(toLiveEntries(rows, ["Global", "Global/Form"])).toEqual([]);
  });

  it("defends against missing or non-string cells at the Coda boundary", () => {
    const rows: TableRow[] = [
      { _codaId: "i-1", name: 42, tier: "Global", type: undefined },
    ];

    const entries = toLiveEntries(rows, ["Global"]);

    expect(entries.at(0)).toEqual({
      rowId: "i-1",
      name: "",
      tier: "Global",
      type: "",
    });
  });

  it("reads a bare-string tier as well as a lookup object", () => {
    const rows: TableRow[] = [
      { _codaId: "i-1", name: "X", tier: "Global", type: "Component" },
    ];
    expect(toLiveEntries(rows, ["Global"]).at(0)?.tier).toBe("Global");
  });

  it("treats a lookup object with a non-string name as empty", () => {
    // tier resolves to "" (out of scope) → row skipped; type also "" defensively.
    const rows: TableRow[] = [
      {
        _codaId: "i-1",
        name: "X",
        tier: { id: "t", name: 5 },
        type: { id: "y" },
      },
    ];
    expect(toLiveEntries(rows, ["Global", ""])).toEqual([
      { rowId: "i-1", name: "X", tier: "", type: "" },
    ]);
  });
});

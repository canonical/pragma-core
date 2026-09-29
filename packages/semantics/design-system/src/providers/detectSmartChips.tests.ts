import { describe, expect, it } from "vitest";
import { detectSmartChips } from "./detectSmartChips.js";

describe("detectSmartChips", () => {
  it("detects a Coda chip and recovers the canonical row id", () => {
    const chips = detectSmartChips(
      "See [Accordion.Item](https://coda.io/d/_dNyzE_TLZDh#_tugrid-20dWwIHYhx/_rui-OEp6lXTfz2).",
    );

    expect(chips).toEqual([
      {
        label: "Accordion.Item",
        url: "https://coda.io/d/_dNyzE_TLZDh#_tugrid-20dWwIHYhx/_rui-OEp6lXTfz2",
        tableId: "grid-20dWwIHYhx",
        rowId: "i-OEp6lXTfz2",
      },
    ]);
  });

  it("detects multiple chips in order of appearance", () => {
    const chips = detectSmartChips(
      "[A](https://coda.io/d/_dX#_tugrid-AAA/_rui-aaa) then [B](https://coda.io/d/_dX#_tugrid-BBB/_rui-bbb)",
    );

    expect(chips.map((c) => c.rowId)).toEqual(["i-aaa", "i-bbb"]);
    expect(chips.map((c) => c.label)).toEqual(["A", "B"]);
  });

  it("ignores non-Coda markdown links", () => {
    expect(detectSmartChips("A [plain link](https://example.com).")).toEqual(
      [],
    );
  });

  it("returns [] for strings without a coda.io reference", () => {
    expect(detectSmartChips("no links here")).toEqual([]);
  });

  it("returns [] for non-string input", () => {
    expect(detectSmartChips(undefined as unknown as string)).toEqual([]);
  });
});

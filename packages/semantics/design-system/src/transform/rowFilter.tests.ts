import { describe, expect, it } from "vitest";
import type { RowFilter } from "../config/types.js";
import { rowPassesFilter } from "./rowFilter.js";

describe("rowPassesFilter", () => {
  describe("nonEmpty", () => {
    const filter: RowFilter = {
      nonEmpty: [{ column: "content", minLength: 20 }],
    };

    it("keeps a row whose column meets the minimum length", () => {
      const row = { name: "Foundations: Grid", content: "x".repeat(20) };
      expect(rowPassesFilter(row, filter)).toBe(true);
    });

    it("drops a row whose column is empty", () => {
      const row = { name: "A stub concept", content: "" };
      expect(rowPassesFilter(row, filter)).toBe(false);
    });

    it("drops a row whose column is shorter than minLength", () => {
      const row = { name: "Tiny", content: "too short" };
      expect(rowPassesFilter(row, filter)).toBe(false);
    });

    it("drops a row whose column is missing", () => {
      const row = { name: "No content column at all" };
      expect(rowPassesFilter(row, filter)).toBe(false);
    });

    it("defaults minLength to 1 (any non-empty value passes)", () => {
      const row = { content: "a" };
      expect(rowPassesFilter(row, { nonEmpty: [{ column: "content" }] })).toBe(
        true,
      );
    });

    it("requires EVERY listed column to be non-empty (logical AND)", () => {
      const both: RowFilter = {
        nonEmpty: [{ column: "content" }, { column: "summary" }],
      };
      expect(rowPassesFilter({ content: "yes", summary: "" }, both)).toBe(
        false,
      );
      expect(rowPassesFilter({ content: "yes", summary: "also" }, both)).toBe(
        true,
      );
    });
  });

  describe("nameIn", () => {
    const filter: RowFilter = {
      nameIn: {
        column: "name",
        values: ["Foundations: Grid", "SkeletonLoading"],
      },
    };

    it("keeps a named row (case-insensitive, trimmed)", () => {
      expect(rowPassesFilter({ name: "  foundations: grid " }, filter)).toBe(
        true,
      );
    });

    it("drops a row not in the name list", () => {
      expect(rowPassesFilter({ name: "Something else" }, filter)).toBe(false);
    });
  });

  describe("lookup-object cells", () => {
    it("treats a lookup whose name is not a string as empty", () => {
      // A half-resolved Coda lookup: the object exists but carries no display
      // name. It identifies nothing, so the row is not a subject.
      expect(
        rowPassesFilter(
          { name: { id: "i-1", name: null } },
          { nonEmpty: [{ column: "name" }] },
        ),
      ).toBe(false);
    });

    it("measures a non-string, non-lookup cell by its string form", () => {
      // Numeric and boolean cells reach the filter as-is; a zero is content,
      // not emptiness.
      expect(
        rowPassesFilter({ name: 0 }, { nonEmpty: [{ column: "name" }] }),
      ).toBe(true);
      expect(
        rowPassesFilter(
          { name: 12345 },
          { nonEmpty: [{ column: "name", minLength: 4 }] },
        ),
      ).toBe(true);
    });

    it("reads a { id, name } lookup cell by its name", () => {
      const filter: RowFilter = {
        nameIn: { column: "type", values: ["Decision guide"] },
      };
      const row = { type: { id: "i-abc", name: "Decision guide" } };
      expect(rowPassesFilter(row, filter)).toBe(true);
    });
  });

  it("combines nameIn AND nonEmpty (both must hold)", () => {
    const filter: RowFilter = {
      nameIn: { column: "name", values: ["Foundations: Grid"] },
      nonEmpty: [{ column: "content", minLength: 20 }],
    };
    expect(
      rowPassesFilter(
        { name: "Foundations: Grid", content: "x".repeat(20) },
        filter,
      ),
    ).toBe(true);
    // Right name, empty content → dropped.
    expect(
      rowPassesFilter({ name: "Foundations: Grid", content: "" }, filter),
    ).toBe(false);
    // Non-empty content, wrong name → dropped.
    expect(
      rowPassesFilter({ name: "Other", content: "x".repeat(20) }, filter),
    ).toBe(false);
  });
});

import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import loadTargetSpec from "./loadTargetSpec.js";

vi.mock("node:fs/promises");

const VALID_SPEC = {
  scope: { documentId: "doc", table: "grid-x", tiers: ["Global"] },
  entries: [],
};

/** Stub the file read with the given raw contents. */
function stubFile(raw: string): void {
  vi.mocked(readFile).mockResolvedValue(raw);
}

/** A spec with the given single entry, sharing VALID_SPEC's scope. */
function specWithEntry(entry: unknown): string {
  return JSON.stringify({ scope: VALID_SPEC.scope, entries: [entry] });
}

/** A well-formed `{ name, tier, type }` target shape. */
const VALID_TARGET = { name: "X", tier: "Global", type: "Component" };

describe("loadTargetSpec", () => {
  beforeEach(() => {
    vi.mocked(readFile).mockReset();
  });

  it("parses a valid spec from disk", async () => {
    stubFile(JSON.stringify(VALID_SPEC));
    const spec = await loadTargetSpec("spec.json");
    expect(spec.scope.documentId).toBe("doc");
    expect(spec.entries).toEqual([]);
  });

  it("rejects a non-object top level", async () => {
    stubFile("42");
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "target spec must be an object",
    );
  });

  it("rejects a missing scope", async () => {
    stubFile(JSON.stringify({ entries: [] }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "must have a `scope` object",
    );
  });

  it("rejects scope without string documentId/table", async () => {
    stubFile(
      JSON.stringify({
        scope: { documentId: 1, table: "t", tiers: ["G"] },
        entries: [],
      }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "string `documentId` and `table`",
    );
  });

  it("rejects an empty tiers array", async () => {
    stubFile(
      JSON.stringify({
        scope: { documentId: "d", table: "t", tiers: [] },
        entries: [],
      }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "scope.tiers must be a non-empty array",
    );
  });

  it("rejects a missing entries array", async () => {
    stubFile(
      JSON.stringify({ scope: { documentId: "d", table: "t", tiers: ["G"] } }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "must have an `entries` array",
    );
  });

  it("propagates a JSON parse error", async () => {
    stubFile("{ not json");
    await expect(loadTargetSpec("spec.json")).rejects.toThrow();
  });

  it("rejects a non-object entry (a1)", async () => {
    stubFile(specWithEntry(42));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0] must be an object",
    );
  });

  it("rejects an op that is not a legal kind (a2)", async () => {
    stubFile(specWithEntry({ rowId: "i-1", target: VALID_TARGET, op: "frob" }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      'entries[0]: op must be one of [keep, move, rename, rename+retype, retype, merge, create] (got "frob")',
    );
  });

  it("rejects a rowId that is neither string nor null (a3)", async () => {
    stubFile(specWithEntry({ rowId: 7, target: VALID_TARGET, op: "rename" }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: rowId must be a string or null",
    );
  });

  it("rejects a target that is present but not a {name,tier,type} object (a4)", async () => {
    stubFile(
      specWithEntry({ rowId: "i-1", target: { name: "X" }, op: "rename" }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: target must be a {name, tier, type} object or null",
    );
  });

  it("rejects a create op with a null target (a5)", async () => {
    stubFile(specWithEntry({ rowId: null, target: null, op: "create" }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: create op must have a non-null target",
    );
  });

  it("rejects a merge op whose target is not null (a6)", async () => {
    stubFile(
      specWithEntry({
        rowId: "i-1",
        target: VALID_TARGET,
        op: "merge",
        mergeInto: "i-2",
      }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: merge op must have target null",
    );
  });

  it("rejects a merge op with a non-string mergeInto (a7)", async () => {
    stubFile(specWithEntry({ rowId: "i-1", target: null, op: "merge" }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: merge op must have a string mergeInto",
    );
  });

  it("rejects a mutate op with a non-string rowId (a8)", async () => {
    stubFile(
      specWithEntry({ rowId: null, target: VALID_TARGET, op: "rename" }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: rename op must have a string rowId",
    );
  });

  it("rejects a mutate op with a null target (a9)", async () => {
    // rowId is a string (passes a8) so the a9 null-target check is reached.
    stubFile(specWithEntry({ rowId: "i-1", target: null, op: "move" }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: move op must have a non-null target",
    );
  });

  it("rejects a target that is a non-null primitive (isEntryShape non-object arm)", async () => {
    // target is neither null nor an object → isEntryShape's typeof guard returns
    // false on the non-object/null arm (distinct from a4's missing-field arm).
    stubFile(specWithEntry({ rowId: "i-1", target: 42, op: "rename" }));
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: target must be a {name, tier, type} object or null",
    );
  });

  it("rejects a target whose tier/type are not strings (isEntryShape non-string arm)", async () => {
    // target is an object with a string name but a non-string tier → isEntryShape
    // returns false on the field-type arm (not the non-object arm of a4 above).
    stubFile(
      specWithEntry({
        rowId: "i-1",
        target: { name: "X", tier: 1, type: "Component" },
        op: "rename",
      }),
    );
    await expect(loadTargetSpec("spec.json")).rejects.toThrow(
      "entries[0]: target must be a {name, tier, type} object or null",
    );
  });

  it("accepts a well-formed mutate entry (entry validation happy path)", async () => {
    stubFile(specWithEntry({ rowId: "i-1", target: VALID_TARGET, op: "keep" }));
    const spec = await loadTargetSpec("spec.json");
    expect(spec.entries.at(0)?.op).toBe("keep");
  });

  it("accepts a well-formed merge entry (merge happy path)", async () => {
    // Exercises the not-taken (false) arms of the merge checks: target IS null
    // and mergeInto IS a string, so neither a6 nor a7 fires.
    stubFile(
      specWithEntry({
        rowId: "i-1",
        target: null,
        op: "merge",
        mergeInto: "i-2",
      }),
    );
    const spec = await loadTargetSpec("spec.json");
    expect(spec.entries.at(0)?.mergeInto).toBe("i-2");
  });
});

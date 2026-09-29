import { readFile } from "node:fs/promises";
import type { OpKind, TargetSpec } from "./types.js";

/** The legal `op` kinds (mirrors {@link OpKind}). */
const OP_KINDS: readonly OpKind[] = [
  "keep",
  "move",
  "rename",
  "rename+retype",
  "retype",
  "merge",
  "create",
] as const;

/** Op kinds that mutate an existing row in place (need a string `rowId` + non-null `target`). */
const MUTATE_KINDS: readonly OpKind[] = [
  "keep",
  "move",
  "rename",
  "rename+retype",
  "retype",
] as const;

/**
 * Load and validate a declarative target-spec file from disk.
 *
 * @param path - path to the target-spec JSON
 * @returns the parsed, shape-checked target spec
 * @throws if the file is missing, not JSON, or structurally invalid
 * @note Impure — reads the file system.
 */
export default async function loadTargetSpec(
  path: string,
): Promise<TargetSpec> {
  const raw = await readFile(path, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  assertValidSpec(parsed);
  return parsed;
}

/**
 * Narrow an unknown value to {@link TargetSpec}, throwing on the first structural fault.
 *
 * @param value - the parsed JSON
 */
function assertValidSpec(value: unknown): asserts value is TargetSpec {
  if (typeof value !== "object" || value === null) {
    throw new Error("target spec must be an object");
  }
  const spec = value as Record<string, unknown>;

  const scope = spec.scope;
  if (typeof scope !== "object" || scope === null) {
    throw new Error("target spec must have a `scope` object");
  }
  const scopeObj = scope as Record<string, unknown>;
  if (
    typeof scopeObj.documentId !== "string" ||
    typeof scopeObj.table !== "string"
  ) {
    throw new Error("scope must have string `documentId` and `table`");
  }
  if (!Array.isArray(scopeObj.tiers) || scopeObj.tiers.length === 0) {
    throw new Error("scope.tiers must be a non-empty array");
  }

  if (!Array.isArray(spec.entries)) {
    throw new Error("target spec must have an `entries` array");
  }
  spec.entries.forEach(assertValidEntry);
}

/** Whether a value is a `{ name, tier, type }` shape with string fields. */
function isEntryShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.tier === "string" &&
    typeof v.type === "string"
  );
}

/**
 * Validate one spec entry's structure (what is knowable from the JSON alone, per
 * op kind). Semantic faults (op kind vs the actual live diff) are checked later
 * in `diffRoster`; this layer fails fast on malformed authoring before any work.
 *
 * @param entry - the parsed entry
 * @param i - its index (for error messages)
 * @throws on the first structural fault
 */
function assertValidEntry(entry: unknown, i: number): void {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`entries[${i}] must be an object`);
  }
  const e = entry as Record<string, unknown>;

  if (
    typeof e.op !== "string" ||
    !(OP_KINDS as readonly string[]).includes(e.op)
  ) {
    throw new Error(
      `entries[${i}]: op must be one of [${OP_KINDS.join(", ")}] (got ${JSON.stringify(e.op)})`,
    );
  }
  const op = e.op as OpKind;

  if (typeof e.rowId !== "string" && e.rowId !== null) {
    throw new Error(`entries[${i}]: rowId must be a string or null`);
  }
  if (e.target !== null && !isEntryShape(e.target)) {
    throw new Error(
      `entries[${i}]: target must be a {name, tier, type} object or null`,
    );
  }

  if (op === "create" && e.target === null) {
    throw new Error(`entries[${i}]: create op must have a non-null target`);
  }
  if (op === "merge") {
    if (e.target !== null) {
      throw new Error(`entries[${i}]: merge op must have target null`);
    }
    if (typeof e.mergeInto !== "string") {
      throw new Error(`entries[${i}]: merge op must have a string mergeInto`);
    }
  }
  if ((MUTATE_KINDS as readonly string[]).includes(op)) {
    if (typeof e.rowId !== "string") {
      throw new Error(`entries[${i}]: ${op} op must have a string rowId`);
    }
    if (e.target === null) {
      throw new Error(`entries[${i}]: ${op} op must have a non-null target`);
    }
  }
}

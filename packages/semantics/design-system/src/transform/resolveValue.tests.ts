import { describe, expect, it } from "vitest";
import { NAMESPACES } from "../constants.js";
import resolveValue from "./resolveValue.js";

describe("resolveValue", () => {
  const refMap = new Map([
    ["i-tier-1", `${NAMESPACES.ds}global`],
    ["global", `${NAMESPACES.ds}global`],
    ["i-tier-2", `${NAMESPACES.ds}apps`],
    ["apps", `${NAMESPACES.ds}apps`],
  ]);

  it("should resolve Coda reference object by ID", () => {
    const value = { id: "i-tier-1", name: "Global" };

    const resolved = resolveValue(value, refMap);

    expect(resolved).toBe(`${NAMESPACES.ds}global`);
  });

  it("should resolve Coda reference object by name if ID not found", () => {
    const value = { id: "unknown", name: "Global" };

    const resolved = resolveValue(value, refMap);

    expect(resolved).toBe(`${NAMESPACES.ds}global`);
  });

  it("should resolve plain string by lowercase lookup", () => {
    const value = "Global";

    const resolved = resolveValue(value, refMap);

    expect(resolved).toBe(`${NAMESPACES.ds}global`);
  });

  it("should return original string if not found", () => {
    const value = "Unknown";

    const resolved = resolveValue(value, refMap);

    expect(resolved).toBe("Unknown");
  });

  it("should resolve CSV string to array of URIs", () => {
    const value = "Global, Apps";

    const resolved = resolveValue(value, refMap);

    expect(resolved).toEqual([
      `${NAMESPACES.ds}global`,
      `${NAMESPACES.ds}apps`,
    ]);
  });

  it("should resolve array of references", () => {
    const value = [
      { id: "i-tier-1", name: "Global" },
      { id: "i-tier-2", name: "Apps" },
    ];

    const resolved = resolveValue(value, refMap);

    expect(resolved).toEqual([
      `${NAMESPACES.ds}global`,
      `${NAMESPACES.ds}apps`,
    ]);
  });

  it("should return null/undefined unchanged", () => {
    expect(resolveValue(null, refMap)).toBeNull();
    expect(resolveValue(undefined, refMap)).toBeUndefined();
  });

  it("should return numbers unchanged", () => {
    expect(resolveValue(42, refMap)).toBe(42);
  });

  it("should return booleans unchanged", () => {
    expect(resolveValue(true, refMap)).toBe(true);
  });
});

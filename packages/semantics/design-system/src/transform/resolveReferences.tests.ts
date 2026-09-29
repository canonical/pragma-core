import { describe, expect, it } from "vitest";
import { NAMESPACES } from "../constants.js";
import resolveReferences from "./resolveReferences.js";

describe("resolveReferences", () => {
  it("should build lookup map from rows by Coda ID", () => {
    const rows = [
      { _codaId: "i-tier-1", Name: "Global", uri: `${NAMESPACES.ds}global` },
      { _codaId: "i-tier-2", Name: "Apps", uri: `${NAMESPACES.ds}apps` },
    ];

    const map = resolveReferences(rows, {
      uriTemplate: "{uri}",
      keyColumn: "Name",
    });

    expect(map.get("i-tier-1")).toBe(`${NAMESPACES.ds}global`);
    expect(map.get("i-tier-2")).toBe(`${NAMESPACES.ds}apps`);
  });

  it("should build lookup map by lowercase name", () => {
    const rows = [
      { _codaId: "i-tier-1", Name: "Global", uri: `${NAMESPACES.ds}global` },
    ];

    const map = resolveReferences(rows, {
      uriTemplate: "{uri}",
      keyColumn: "Name",
    });

    expect(map.get("global")).toBe(`${NAMESPACES.ds}global`);
  });

  it("should use Name as default key column", () => {
    const rows = [
      { _codaId: "i-123", Name: "Test", uri: `${NAMESPACES.ds}test` },
    ];

    const map = resolveReferences(rows, { uriTemplate: "{uri}" });

    expect(map.get("test")).toBe(`${NAMESPACES.ds}test`);
  });

  it("should handle custom key column", () => {
    const rows = [
      { _codaId: "i-1", name: "button", uri: `${NAMESPACES.ds}button` },
    ];

    const map = resolveReferences(rows, {
      uriTemplate: "{uri}",
      keyColumn: "name",
    });

    expect(map.get("button")).toBe(`${NAMESPACES.ds}button`);
  });

  it("should build URI from template", () => {
    const rows = [{ _codaId: "i-1", Name: "Component" }];

    const map = resolveReferences(rows, {
      uriTemplate: `${NAMESPACES.ds}{Name}`,
      keyColumn: "Name",
    });

    expect(map.get("component")).toBe(`${NAMESPACES.ds}Component`);
  });
});

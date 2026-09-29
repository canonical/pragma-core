import { describe, expect, it } from "vitest";
import type { TransformConfig } from "../config/types.js";
import expectedTables from "./expectedTables.js";

const DS = "https://ds.canonical.com/";

/** Minimal transform config with the given tables/references. */
function makeConfig(
  overrides: Partial<Pick<TransformConfig, "tables" | "references">>,
): TransformConfig {
  return {
    format: "ttl",
    outputDir: "data/",
    atomicity: "instance",
    tables: {},
    ...overrides,
  };
}

describe("expectedTables", () => {
  it("includes every configured output table, sorted", () => {
    const config = makeConfig({
      tables: {
        uiBlocks: {
          "@context": { ds: DS, name: "ds:name" },
          class: "ds:Component",
          uriTemplate: "{uri}",
        },
        tiers: {
          "@context": { ds: DS, name: "ds:name" },
          class: "ds:Tier",
          uriTemplate: "{uri}",
        },
      },
    });

    expect(expectedTables(config)).toEqual(["tiers", "uiBlocks"]);
  });

  it("includes reference tables that are not configured as outputs", () => {
    const config = makeConfig({
      tables: {
        uiBlocks: {
          "@context": { ds: DS, name: "ds:name" },
          class: "{type}",
          uriTemplate: "{uri}",
        },
      },
      references: {
        uiBlockTypes: { uriTemplate: `${DS}{Name}`, keyColumn: "Name" },
      },
    });

    expect(expectedTables(config)).toEqual(["uiBlockTypes", "uiBlocks"]);
  });

  it("includes tables embedded via @inline context entries", () => {
    const config = makeConfig({
      tables: {
        uiBlocks: {
          "@context": {
            ds: DS,
            name: "ds:name",
            tier: { "@id": "ds:tier", "@type": "@id" },
            properties: {
              "@id": "ds:hasProperty",
              "@inline": {
                table: "properties",
                class: "ds:Property",
                properties: { "property name": "ds:name" },
              },
            },
          },
          class: "ds:Component",
          uriTemplate: "{uri}",
        },
      },
    });

    expect(expectedTables(config)).toEqual(["properties", "uiBlocks"]);
  });

  it("de-duplicates tables appearing as both output and reference", () => {
    const config = makeConfig({
      tables: {
        tiers: {
          "@context": { ds: DS, name: "ds:name" },
          class: "ds:Tier",
          uriTemplate: "{uri}",
        },
      },
      references: {
        tiers: { uriTemplate: "{uri}", keyColumn: "name" },
      },
    });

    expect(expectedTables(config)).toEqual(["tiers"]);
  });
});

/**
 * parseArtifactToken unit tests — §4D.
 *
 * Tests DTCG→CSS type narrowing, colour resolution, path resolution,
 * and default handling for all TokenNode fields.
 */
import { describe, expect, it } from "vitest";
import type { RawArtifactToken } from "../types/index.js";
import parseArtifactToken from "./parseArtifactToken.js";

function makeRaw(overrides?: Partial<RawArtifactToken>): RawArtifactToken {
  return {
    id: "color.test",
    type: "color",
    value: "#ff0000",
    description: "Test colour",
    tier: "semantic",
    isPaired: false,
    aliasChain: [],
    extensions: {},
    registered: false,
    cssOutputFile: "tokens.css",
    ...overrides,
  } as RawArtifactToken;
}

describe("parseArtifactToken", () => {
  // -----------------------------------------------------------------------
  // Field mapping
  // -----------------------------------------------------------------------

  it("sets provenance to artifact with the given packageSource", () => {
    const node = parseArtifactToken("--color-bg", makeRaw(), "@acme/tokens");
    expect(node.provenance).toEqual({
      kind: "artifact",
      packageSource: "@acme/tokens",
    });
    expect(node.packageSource).toBe("@acme/tokens");
  });

  it("maps cssVar from the first argument", () => {
    const node = parseArtifactToken("--my-var", makeRaw());
    expect(node.cssVar).toBe("--my-var");
  });

  it("maps basic fields: id, type, description, tier, isPaired", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({
        id: "spacing.md",
        type: "dimension",
        description: "Medium spacing",
        tier: "primitive",
        isPaired: true,
      }),
    );
    expect(node.id).toBe("spacing.md");
    expect(node.type).toBe("dimension");
    expect(node.description).toBe("Medium spacing");
    expect(node.tier).toBe("primitive");
    expect(node.isPaired).toBe(true);
  });

  it("preserves visibility and defaults older artifacts to public", () => {
    expect(
      parseArtifactToken("--internal", makeRaw({ visibility: "internal" }))
        .visibility,
    ).toBe("internal");
    expect(parseArtifactToken("--legacy", makeRaw()).visibility).toBe("public");
  });

  it("defaults missing optional fields to null/empty/false", () => {
    const minimal: RawArtifactToken = {
      id: "t",
      type: "color",
      value: "red",
    } as RawArtifactToken;
    const node = parseArtifactToken("--x", minimal);
    expect(node.description).toBe("");
    expect(node.tier).toBeNull();
    expect(node.aliasChain).toEqual([]);
    expect(node.isPrimary).toBe(true);
    expect(node.isPaired).toBe(false);
    expect(node.registered).toBe(false);
    expect(node.syntax).toBeNull();
    expect(node.inherits).toBeNull();
    expect(node.initialValue).toBeNull();
    expect(node.derivedFrom).toBeNull();
    expect(node.derivation).toBeNull();
    expect(node.extensions).toEqual({});
  });

  it("sets isPrimary false when aliasChain is non-empty", () => {
    const node = parseArtifactToken("--x", makeRaw({ aliasChain: ["--y"] }));
    expect(node.isPrimary).toBe(false);
  });

  // -----------------------------------------------------------------------
  // DTCG→CSS type narrowing
  // -----------------------------------------------------------------------

  it("maps 'color' DTCG type to '<color>' CSS type", () => {
    const node = parseArtifactToken("--x", makeRaw({ type: "color" }));
    expect(node.cssType).toBe("<color>");
  });

  it("narrows 'dimension' DTCG type based on the value unit", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({ type: "dimension", value: "24px" }),
    );
    expect(node.cssType).toBe("<length>");
  });

  it("uses registered syntax for CSS type when registered", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({ registered: true, syntax: "<length>" }),
    );
    expect(node.cssType).toBe("<length>");
  });

  // -----------------------------------------------------------------------
  // Colour resolution
  // -----------------------------------------------------------------------

  it("resolves hex colour values for light and dark", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({
        value: "#ff0000",
        valueLight: "#00ff00",
        valueDark: "#0000ff",
      }),
    );
    expect(node.hexLight).toBe("#00ff00");
    expect(node.hexDark).toBe("#0000ff");
  });

  it("resolves oklch components from colour values", () => {
    const node = parseArtifactToken("--x", makeRaw({ value: "#ff0000" }));
    expect(node.oklchLight).not.toBeNull();
    expect(node.oklchLight).toHaveProperty("l");
    expect(node.oklchLight).toHaveProperty("c");
    expect(node.oklchLight).toHaveProperty("h");
  });

  it("returns null oklch/hex for non-colour values", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({
        type: "dimension",
        value: "24px",
        valueLight: "24px",
        valueDark: "24px",
      }),
    );
    expect(node.oklchLight).toBeNull();
    expect(node.hexLight).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Path resolution
  // -----------------------------------------------------------------------

  it("resolves relative cssOutputFile paths against artifactDir", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({ cssOutputFile: "tokens.css" }),
      "",
      "/project/dist",
    );
    expect(node.cssOutputFile).toBe("/project/dist/tokens.css");
  });

  it("preserves absolute paths", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({ cssOutputFile: "/absolute/tokens.css" }),
      "",
      "/project/dist",
    );
    expect(node.cssOutputFile).toBe("/absolute/tokens.css");
  });

  it("returns null for missing cssOutputFile", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({ cssOutputFile: undefined }),
    );
    expect(node.cssOutputFile).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Value resolution
  // -----------------------------------------------------------------------

  it("falls back to value when valueLight/valueDark are missing", () => {
    const node = parseArtifactToken("--x", makeRaw({ value: "#abc" }));
    expect(node.valueLight).toBe("#abc");
    expect(node.valueDark).toBe("#abc");
  });

  it("prefers explicit valueLight/valueDark over value", () => {
    const node = parseArtifactToken(
      "--x",
      makeRaw({ value: "#000", valueLight: "#fff", valueDark: "#111" }),
    );
    expect(node.valueLight).toBe("#fff");
    expect(node.valueDark).toBe("#111");
  });
});

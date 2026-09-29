import { describe, expect, it } from "vitest";
import serializeArtifact from "./serializeArtifact.js";
import type { Artifact } from "./types.js";

describe("serializeArtifact", () => {
  it("serializes an artifact to formatted JSON", () => {
    const artifact: Artifact = {
      "--color-fg": {
        cssVar: "--color-fg",
        id: "color.fg",
        type: "color",
        tier: "semantic",
        isPaired: false,
        cssOutputFile: "sets.semantic.css",
      },
    };

    const json = serializeArtifact(artifact);
    const parsed = JSON.parse(json);

    expect(parsed["--color-fg"]).toMatchObject({
      cssVar: "--color-fg",
      id: "color.fg",
      tier: "semantic",
    });
  });

  it("produces stable JSON (keys sorted by insertion order)", () => {
    const artifact: Artifact = {
      "--b": {
        cssVar: "--b",
        id: "b",
        type: "color",
        tier: "primitive",
        isPaired: false,
        cssOutputFile: "sets.primitive.css",
      },
      "--a": {
        cssVar: "--a",
        id: "a",
        type: "color",
        tier: "primitive",
        isPaired: false,
        cssOutputFile: "sets.primitive.css",
      },
    };

    const json = serializeArtifact(artifact);
    expect(json).toContain('"--b"');
    expect(json).toContain('"--a"');
    expect(json).toMatch(/^\{\n {2}/);
  });
});

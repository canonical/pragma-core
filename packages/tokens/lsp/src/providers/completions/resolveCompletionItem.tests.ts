/**
 * completionItem/resolve tests — TDD (P8.7 gate).
 */
import { describe, expect, it } from "vitest";
import { loadArtifact, TokenGraph } from "../../graph/index.js";
import { makeConfig } from "../../testing/index.js";
import type { CompletionItem, RawArtifact } from "../../types/index.js";
import resolveCompletionItem from "./resolveCompletionItem.js";

const ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-bg": {
      id: "color.background",
      type: "color",
      value: "#fff",
      description: "Background colour",
      tier: "semantic",
      cssOutputFile: "/project/dist/tokens.css",
    },
  },
};

describe("resolveCompletionItem", () => {
  it("adds documentation lazily (P8.7)", () => {
    const graph = new TokenGraph();
    loadArtifact(ARTIFACT, graph);
    const config = makeConfig();
    const item: CompletionItem = {
      label: "--color-bg",
      detail: "test",
    };
    // Item starts without documentation
    expect(item.documentation).toBeUndefined();
    const resolved = resolveCompletionItem(
      item,
      "file:///app.css",
      graph,
      config,
    );
    expect(resolved.documentation).toBeDefined();
    expect(resolved.documentation?.kind).toBe("markdown");
    expect(resolved.documentation?.value.length).toBeGreaterThan(0);
  });

  it("preserves existing documentation", () => {
    const graph = new TokenGraph();
    const config = makeConfig();
    const item: CompletionItem = {
      label: "--unknown",
      documentation: { kind: "markdown", value: "existing" },
    };
    const resolved = resolveCompletionItem(
      item,
      "file:///app.css",
      graph,
      config,
    );
    expect(resolved.documentation?.value).toBe("existing");
  });
});

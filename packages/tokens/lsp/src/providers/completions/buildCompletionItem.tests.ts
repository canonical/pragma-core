import { describe, expect, it } from "vitest";
import { TokenGraph } from "../../graph/index.js";
import { makeConfig, makeTokenNode } from "../../testing/index.js";
import { CompletionItemKind, InsertTextFormat } from "../../types/index.js";
import buildCompletionItem from "./buildCompletionItem.js";

function setup() {
  const graph = new TokenGraph();
  const config = makeConfig();
  return { graph, config };
}

describe("buildCompletionItem", () => {
  it("returns an artifact token completion with snippet format", () => {
    const { graph, config } = setup();
    const token = makeTokenNode({
      cssVar: "--color-primary",
      type: "color",
      tier: "semantic",
      valueLight: "#00f",
    });
    graph.addToken(token);

    const item = buildCompletionItem(
      "--color-primary",
      "file:///a.css",
      graph,
      config,
      null,
    );
    expect(item).not.toBeNull();
    if (!item) {
      throw new Error("Expected a completion item");
    }
    expect(item.label).toBe("--color-primary");
    expect(item.insertTextFormat).toBe(InsertTextFormat.Snippet);
    expect(item.insertText).toContain("--color-primary");
    expect(item.kind).toBe(CompletionItemKind.Color);
  });

  it("returns Variable kind for non-color artifact tokens", () => {
    const { graph, config } = setup();
    const token = makeTokenNode({
      cssVar: "--spacing-md",
      type: "dimension",
      tier: "primitive",
    });
    graph.addToken(token);

    const item = buildCompletionItem(
      "--spacing-md",
      "file:///a.css",
      graph,
      config,
      null,
    );
    expect(item).not.toBeNull();
    if (!item) {
      throw new Error("Expected a completion item");
    }
    expect(item.kind).toBe(CompletionItemKind.Variable);
  });

  it("returns Property kind for @property entries", () => {
    const { graph, config } = setup();
    graph.addProperty({
      cssVar: "--x",
      fileUri: "file:///a.css",
      syntax: "<length>",
      inherits: true,
      initialValue: "0px",
      cssType: "<length>",
      line: 0,
    });

    const item = buildCompletionItem(
      "--x",
      "file:///a.css",
      graph,
      config,
      null,
    );
    expect(item).not.toBeNull();
    if (!item) {
      throw new Error("Expected a completion item");
    }
    expect(item.kind).toBe(CompletionItemKind.Property);
  });

  it("returns a buffer completion when var is unresolved", () => {
    const { graph, config } = setup();
    // No token, property, or declaration for this var
    const item = buildCompletionItem(
      "--unknown",
      "file:///a.css",
      graph,
      config,
      null,
    );
    expect(item).not.toBeNull();
    if (!item) {
      throw new Error("Expected a completion item");
    }
    expect(item.detail).toContain("buffer");
  });
});

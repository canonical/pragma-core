import { describe, expect, it, vi } from "vitest";
import createServerState from "../createServerState.js";
import handleOpenDocument from "./handleOpenDocument.js";

describe("handleOpenDocument", () => {
  it("indexes the opened document and publishes diagnostics", async () => {
    const postMessage = vi.fn();
    const state = createServerState({
      debug: vi.fn(),
      postMessage,
      rootDir: "/project",
    });

    await handleOpenDocument(state, {
      id: 1,
      type: "OPEN_DOC",
      uri: "file:///project/app.css",
      text: ":root { --brand-color: #e95420; }",
    });

    expect(state.openDocuments.get("file:///project/app.css")).toContain(
      "--brand-color",
    );
    expect(state.openTrees.has("file:///project/app.css")).toBe(true);
    expect(
      state.graph
        .getDeclarationsByFile("file:///project/app.css")
        .map((item) => item.cssVar),
    ).toEqual(["--brand-color"]);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        type: "DIAGNOSTICS_RESULT",
        uri: "file:///project/app.css",
      }),
    );
  });
});

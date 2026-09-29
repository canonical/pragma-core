import { describe, expect, it, vi } from "vitest";
import { parseCSS } from "../../css/lezer/index.js";
import createServerState from "../createServerState.js";
import handleFileChanged from "./handleFileChanged.js";

describe("handleFileChanged", () => {
  it("reindexes the changed file from the latest open buffer", async () => {
    const uri = "file:///project/app.css";
    const state = createServerState({
      postMessage: vi.fn(),
      rootDir: "/project",
    });
    state.openDocuments.set(uri, ":root { --brand-color: #e95420; }");
    state.openTrees.set(uri, parseCSS(":root { --brand-color: #e95420; }"));

    await handleFileChanged(state, {
      id: 4,
      type: "FILE_CHANGED",
      uri,
    });

    expect(
      state.graph.getDeclarationsByFile(uri).map((item) => item.cssVar),
    ).toEqual(["--brand-color"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import * as lezer from "../../css/lezer/index.js";
import createServerState from "../createServerState.js";
import handleChangeDocument from "./handleChangeDocument.js";

describe("handleChangeDocument", () => {
  it("updates the open buffer and pushes diagnostics after debounce", async () => {
    vi.useFakeTimers();
    try {
      const postMessage = vi.fn();
      const uri = "file:///project/app.css";
      const state = createServerState({
        postMessage,
        rootDir: "/project",
      });
      state.openDocuments.set(uri, ":root { --before: red; }");
      state.openTrees.set(uri, lezer.parseCSS(":root { --before: red; }"));

      handleChangeDocument(state, {
        id: 2,
        type: "CHANGE_DOC",
        uri,
        changes: [{ text: ":root { --after: blue; }" }],
      });

      await vi.runAllTimersAsync();

      expect(state.openDocuments.get(uri)).toBe(":root { --after: blue; }");
      expect(
        state.graph.getDeclarationsByFile(uri).map((item) => item.cssVar),
      ).toEqual(["--after"]);
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 2,
          type: "PUSH_DIAGNOSTICS",
          uri,
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, expect, it } from "vitest";
import createServerState from "../createServerState.js";
import handleCloseDocument from "./handleCloseDocument.js";

describe("handleCloseDocument", () => {
  it("removes open document state and clears pending updates", () => {
    const uri = "file:///project/app.css";
    const state = createServerState({
      postMessage: () => {},
      rootDir: "/project",
    });
    const timer = setTimeout(() => {}, 1000);
    state.openDocuments.set(uri, ":root {}");
    state.openTrees.set(uri, {} as never);
    state.pendingUpdates.set(uri, { timer, uri });

    handleCloseDocument(state, {
      id: 3,
      type: "CLOSE_DOC",
      uri,
    });

    expect(state.openDocuments.has(uri)).toBe(false);
    expect(state.openTrees.has(uri)).toBe(false);
    expect(state.pendingUpdates.has(uri)).toBe(false);
  });
});

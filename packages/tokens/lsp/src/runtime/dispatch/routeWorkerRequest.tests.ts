import { describe, expect, it, vi } from "vitest";
import createServerState from "../createServerState.js";
import routeWorkerRequest from "./routeWorkerRequest.js";

describe("routeWorkerRequest", () => {
  it("dispatches open document requests through the document handlers", async () => {
    const postMessage = vi.fn();
    const state = createServerState({
      postMessage,
      rootDir: "/project",
    });
    state.configPromise = Promise.resolve();

    await routeWorkerRequest(state, {
      id: 1,
      type: "OPEN_DOC",
      uri: "file:///project/app.css",
      text: ":root { --brand-color: #e95420; }",
    });

    expect(
      state.graph
        .getDeclarationsByFile("file:///project/app.css")
        .map((item) => item.cssVar),
    ).toEqual(["--brand-color"]);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DIAGNOSTICS_RESULT" }),
    );
  });

  it("routes completion requests to provider-backed responses", async () => {
    const postMessage = vi.fn();
    const state = createServerState({
      postMessage,
      rootDir: "/project",
    });
    state.configPromise = Promise.resolve();
    state.openDocuments.set(
      "file:///project/app.css",
      ":root { --brand-color: #e95420; }",
    );

    await routeWorkerRequest(state, {
      id: 2,
      type: "COMPLETION",
      uri: "file:///project/app.css",
      position: { line: 0, character: 10 },
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        type: "COMPLETION_RESULT",
      }),
    );
  });
});

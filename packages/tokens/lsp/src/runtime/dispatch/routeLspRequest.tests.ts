import { describe, expect, it, vi } from "vitest";
import { makeTransport } from "../../testing/index.js";
import type { GraphWorker } from "../createGraphWorker.js";
import routeLspRequest from "./routeLspRequest.js";
import type { LspServerState } from "./types.js";

function createState(worker?: GraphWorker): LspServerState {
  return {
    allowDegraded: false,
    fallbackRootDir: "/project",
    initialized: Boolean(worker),
    pendingRequests: new Map(),
    requestSeq: 0,
    shutdownRequested: false,
    worker,
  };
}

describe("routeLspRequest", () => {
  it("forwards completion requests to the worker and tracks the pending request", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });
    const transport = makeTransport();

    await routeLspRequest(
      state,
      {
        id: 1,
        method: "textDocument/completion",
        params: {
          textDocument: { uri: "file:///project/app.css" },
          position: { line: 2, character: 4 },
        },
      },
      transport,
    );

    expect(handleRequest).toHaveBeenCalledWith({
      id: 1,
      type: "COMPLETION",
      uri: "file:///project/app.css",
      position: { line: 2, character: 4 },
    });
    expect(state.pendingRequests.get(1)).toEqual({
      id: 1,
      method: "textDocument/completion",
    });
  });

  it("responds to color presentation requests without touching the worker", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });
    const transport = makeTransport();

    await routeLspRequest(
      state,
      {
        id: 9,
        method: "textDocument/colorPresentation",
        params: {},
      },
      transport,
    );

    expect(handleRequest).not.toHaveBeenCalled();
    expect(transport.sendResponse).toHaveBeenCalledWith(9, [
      { label: "var()" },
    ]);
  });

  it("forwards didOpen using a synthetic id when the notification has none", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });
    const transport = makeTransport();

    await routeLspRequest(
      state,
      {
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri: "file:///project/app.css",
            text: ":root { --x: red; }",
          },
        },
      },
      transport,
    );

    expect(handleRequest).toHaveBeenCalledWith({
      id: 1,
      type: "OPEN_DOC",
      uri: "file:///project/app.css",
      text: ":root { --x: red; }",
    });
    // didOpen is a notification — it must NOT register a correlation entry.
    // (Diagnostics are published via a notification, not an id-correlated
    // response, so a pending entry here would leak.)
    expect(state.pendingRequests.has(1)).toBe(false);
  });

  it("responds to shutdown and toggles lifecycle state", async () => {
    const state = createState();
    const transport = makeTransport();

    await routeLspRequest(state, { id: 3, method: "shutdown" }, transport);

    expect(state.shutdownRequested).toBe(true);
    expect(transport.sendResponse).toHaveBeenCalledWith(3, null);
  });
});

describe("routeLspRequest — watched files", () => {
  it("forwards a watched artifact change to the worker", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });

    await routeLspRequest(
      state,
      {
        method: "workspace/didChangeWatchedFiles",
        params: {
          changes: [{ uri: "file:///project/dist/tokens.json", type: 2 }],
        },
      },
      makeTransport(),
    );

    expect(handleRequest).toHaveBeenCalledWith({
      id: 1,
      type: "ARTIFACT_CHANGED",
      path: "/project/dist/tokens.json",
      uri: "file:///project/dist/tokens.json",
    });
  });

  it("ignores a notification whose changes is not an array", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });

    // Truthy but not iterable: the guard has to test the shape, not truthiness.
    await routeLspRequest(
      state,
      {
        method: "workspace/didChangeWatchedFiles",
        params: { changes: {} },
      },
      makeTransport(),
    );

    expect(handleRequest).not.toHaveBeenCalled();
  });

  it("forwards one request per changed file", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });

    await routeLspRequest(
      state,
      {
        method: "workspace/didChangeWatchedFiles",
        params: {
          changes: [
            { uri: "file:///project/a/tokens.json", type: 2 },
            { uri: "file:///project/b/tokens.json", type: 2 },
          ],
        },
      },
      makeTransport(),
    );

    expect(handleRequest).toHaveBeenCalledTimes(2);
  });

  it("does not register the change as a pending request", async () => {
    // ARTIFACT_CHANGED answers with publishDiagnostics rather than an
    // id-correlated response, so a pendingRequests entry would leak.
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });

    await routeLspRequest(
      state,
      {
        method: "workspace/didChangeWatchedFiles",
        params: { changes: [{ uri: "file:///project/dist/tokens.json" }] },
      },
      makeTransport(),
    );

    expect(state.pendingRequests.size).toBe(0);
  });

  it("skips a change whose uri is not a file uri, and keeps the rest", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });

    await routeLspRequest(
      state,
      {
        method: "workspace/didChangeWatchedFiles",
        params: {
          changes: [
            { uri: "untitled:Untitled-1" },
            { uri: "file:///project/dist/tokens.json" },
          ],
        },
      },
      makeTransport(),
    );

    expect(handleRequest).toHaveBeenCalledTimes(1);
    expect(handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/project/dist/tokens.json" }),
    );
  });

  it("ignores a malformed notification", async () => {
    const handleRequest = vi.fn(async () => undefined);
    const state = createState({
      handleRequest,
      config: {} as never,
      graph: {} as never,
    });

    await routeLspRequest(
      state,
      { method: "workspace/didChangeWatchedFiles", params: {} },
      makeTransport(),
    );

    expect(handleRequest).not.toHaveBeenCalled();
  });
});

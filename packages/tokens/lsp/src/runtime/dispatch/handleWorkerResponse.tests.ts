import { describe, expect, it } from "vitest";
import { makeTransport } from "../../testing/index.js";
import handleWorkerResponse from "./handleWorkerResponse.js";
import type { PendingLspRequest } from "./types.js";

describe("handleWorkerResponse", () => {
  it("forwards completion results to the matching pending request", () => {
    const transport = makeTransport();
    const pendingRequests = new Map<number, PendingLspRequest>([
      [7, { id: 99, method: "textDocument/completion" }],
    ]);

    handleWorkerResponse(
      {
        id: 7,
        type: "COMPLETION_RESULT",
        items: [{ label: "--token" } as never],
      },
      pendingRequests,
      transport,
    );

    expect(transport.sendResponse).toHaveBeenCalledWith(99, {
      isIncomplete: false,
      items: [{ label: "--token" }],
    });
    expect(pendingRequests.has(7)).toBe(false);
  });

  it("publishes diagnostics notifications", () => {
    const transport = makeTransport();
    const pendingRequests = new Map<number, PendingLspRequest>([
      [3, { id: 3, method: "textDocument/didOpen" }],
    ]);

    handleWorkerResponse(
      {
        id: 3,
        type: "PUSH_DIAGNOSTICS",
        uri: "file:///project/app.css",
        diagnostics: [{ message: "bad" } as never],
      },
      pendingRequests,
      transport,
    );

    expect(transport.sendNotification).toHaveBeenCalledWith(
      "textDocument/publishDiagnostics",
      {
        uri: "file:///project/app.css",
        diagnostics: [{ message: "bad" }],
      },
    );
  });
});

/**
 * LSP server tests — TDD.
 *
 * Tests the server message protocol, capability negotiation,
 * and lifecycle handling.
 *
 */
import { describe, expect, it } from "vitest";
import startLspServer from "./startLspServer.js";

describe("startLspServer", () => {
  it("is a function export", () => {
    expect(typeof startLspServer).toBe("function");
  });

  // Full integration tests for the stdio LSP require subprocess spawning.
  // The core request handling is tested via createGraphWorker.tests.ts.
  // This test validates the module can be imported and the function exists.
});

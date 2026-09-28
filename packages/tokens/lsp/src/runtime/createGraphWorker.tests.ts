/**
 * GraphWorker tests — TDD.
 *
 * Tests the worker's request handling, artifact loading,
 * and message protocol.
 *
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as lezer from "../css/lezer/index.js";
import type { WorkerResponse } from "../types/index.js";
import ConfigNotFoundError from "./ConfigNotFoundError.js";
import createGraphWorker from "./createGraphWorker.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorker(rootDir = "/project") {
  const messages: WorkerResponse[] = [];
  const worker = createGraphWorker({
    allowDegraded: true,
    rootDir,
    postMessage: (msg) => messages.push(msg),
  });
  return { worker, messages };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createGraphWorker", () => {
  it("creates a worker with an empty graph", () => {
    const { worker } = makeWorker();
    expect(worker.graph.tokenCount).toBe(0);
  });

  it("handles COMPLETION request and posts COMPLETION_RESULT", async () => {
    const { worker, messages } = makeWorker();

    await worker.handleRequest({
      id: 1,
      type: "COMPLETION",
      uri: "file:///a.css",
      position: { line: 0, character: 0 },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("COMPLETION_RESULT");
    expect(messages[0].id).toBe(1);
  });

  it("handles HOVER request and posts HOVER_RESULT", async () => {
    const { worker, messages } = makeWorker();

    await worker.handleRequest({
      id: 2,
      type: "HOVER",
      uri: "file:///a.css",
      position: { line: 0, character: 0 },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("HOVER_RESULT");
    expect(messages[0].id).toBe(2);
  });

  it("handles DEFINITION request and posts DEFINITION_RESULT", async () => {
    const { worker, messages } = makeWorker();

    await worker.handleRequest({
      id: 3,
      type: "DEFINITION",
      uri: "file:///a.css",
      position: { line: 0, character: 0 },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("DEFINITION_RESULT");
    expect(messages[0].id).toBe(3);
  });

  it("handles DIAGNOSTICS request and posts DIAGNOSTICS_RESULT", async () => {
    const { worker, messages } = makeWorker();

    await worker.handleRequest({
      id: 4,
      type: "DIAGNOSTICS",
      uri: "file:///a.css",
      text: ".box { color: red; }",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("DIAGNOSTICS_RESULT");
    expect(messages[0].id).toBe(4);
  });

  it("handles CLOSE_DOC request without error", async () => {
    const { worker, messages } = makeWorker();

    await worker.handleRequest({
      id: 5,
      type: "CLOSE_DOC",
      uri: "file:///a.css",
    });

    // CLOSE_DOC does not post a response
    expect(messages).toHaveLength(0);
  });

  it("handles FILE_CHANGED request without error", async () => {
    const { worker, messages } = makeWorker();

    await worker.handleRequest({
      id: 6,
      type: "FILE_CHANGED",
      uri: "file:///a.css",
    });

    // FILE_CHANGED invalidates cache, no response
    expect(messages).toHaveLength(0);
  });

  it("throws when no config file exists and degraded mode is disabled", async () => {
    const rootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "terrazzo-worker-"),
    );
    const filePath = path.join(rootDir, "src", "index.css");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, ".card { color: red; }", "utf-8");

    const worker = createGraphWorker({
      rootDir,
      postMessage: () => {},
    });

    try {
      await expect(
        worker.handleRequest({
          id: 7,
          type: "DIAGNOSTICS",
          uri: `file://${filePath}`,
          text: ".card { color: red; }",
        }),
      ).rejects.toBeInstanceOf(ConfigNotFoundError);
    } finally {
      await fs.rm(rootDir, { force: true, recursive: true });
    }
  });

  it("logs searched paths and continues in degraded mode when config is missing", async () => {
    const rootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "terrazzo-worker-"),
    );
    const filePath = path.join(rootDir, "src", "index.css");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, ".card { color: red; }", "utf-8");

    const logs: string[] = [];
    const worker = createGraphWorker({
      allowDegraded: true,
      rootDir,
      postMessage: () => {},
      log: (message) => logs.push(message),
    });

    try {
      await worker.handleRequest({
        id: 7,
        type: "DIAGNOSTICS",
        uri: `file://${filePath}`,
        text: ".card { color: red; }",
      });

      expect(logs).toContain("Config not found: terrazzo-lsp.config.json");
      expect(logs).toContain(`Search start: ${path.dirname(filePath)}`);
      expect(logs).toContain(
        `Tried: ${path.join(path.dirname(filePath), "terrazzo-lsp.config.json")}`,
      );
      expect(logs).toContain(
        `Tried: ${path.join(rootDir, "terrazzo-lsp.config.json")}`,
      );
      expect(logs).toContain(
        'Create one with: { "artifacts": ["path/to/tokens.json"] }',
      );
      expect(logs).toContain(
        "Running in degraded mode (--allow-degraded): token-backed editor features stay disabled until a config is added.",
      );
    } finally {
      await fs.rm(rootDir, { force: true, recursive: true });
    }
  });

  it("reuses incremental parse fragments on CHANGE_DOC", async () => {
    const applyTreeChanges = vi.spyOn(lezer, "applyTreeChanges");
    const parseCSS = vi.spyOn(lezer, "parseCSS");
    const { worker } = makeWorker();

    await worker.handleRequest({
      id: 8,
      type: "OPEN_DOC",
      uri: "file:///a.css",
      text: `:root { --x: 1; }\n.button { color: var(--x); }`,
    });

    await worker.handleRequest({
      id: 9,
      type: "CHANGE_DOC",
      uri: "file:///a.css",
      changes: [
        {
          text: `:root { --x: 2; }\n.button { color: var(--x); }`,
        },
      ],
    });

    expect(applyTreeChanges).toHaveBeenCalledOnce();
    expect(parseCSS).toHaveBeenLastCalledWith(
      `:root { --x: 2; }\n.button { color: var(--x); }`,
      expect.any(Array),
    );
  });
});

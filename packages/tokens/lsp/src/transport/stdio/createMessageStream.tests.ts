import { describe, expect, it, vi } from "vitest";
import createMessageStream from "./createMessageStream.js";

describe("createMessageStream", () => {
  it("parses a complete message split across chunks", () => {
    const onMessage = vi.fn();
    const stream = createMessageStream({ onMessage });
    const payload = JSON.stringify({ jsonrpc: "2.0", method: "initialized" });
    const framed = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;

    stream.acceptChunk(framed.slice(0, 10));
    stream.acceptChunk(framed.slice(10));

    expect(onMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      method: "initialized",
    });
  });

  it("parses a message containing multibyte UTF-8 content", () => {
    // Regression: Content-Length is a UTF-8 byte count, not a code-unit count.
    // "ünïcödé" + an emoji make the byte length exceed the JS string length.
    const onMessage = vi.fn();
    const stream = createMessageStream({ onMessage });
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "ünïcödé/✨",
    });
    const framed = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;

    stream.acceptChunk(Buffer.from(framed, "utf-8"));

    expect(onMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: 1,
      method: "ünïcödé/✨",
    });
  });

  it("does not desync when a multibyte message precedes others", () => {
    // Regression: an over-long (code-unit) slice used to consume into the
    // following frames, dropping every subsequent message.
    const onMessage = vi.fn();
    const stream = createMessageStream({ onMessage });
    const frame = (obj: unknown): Buffer => {
      const p = JSON.stringify(obj);
      return Buffer.from(
        `Content-Length: ${Buffer.byteLength(p)}\r\n\r\n${p}`,
        "utf-8",
      );
    };

    stream.acceptChunk(
      Buffer.concat([
        frame({ jsonrpc: "2.0", id: 1, method: "café/ünï" }),
        frame({ jsonrpc: "2.0", id: 2, method: "shutdown" }),
        frame({ jsonrpc: "2.0", id: 3, method: "exit" }),
      ]),
    );

    expect(onMessage).toHaveBeenCalledTimes(3);
    expect(onMessage).toHaveBeenNthCalledWith(1, {
      jsonrpc: "2.0",
      id: 1,
      method: "café/ünï",
    });
    expect(onMessage).toHaveBeenNthCalledWith(3, {
      jsonrpc: "2.0",
      id: 3,
      method: "exit",
    });
  });

  it("drops a frame with invalid JSON without desyncing the next", () => {
    const onMessage = vi.fn();
    const stream = createMessageStream({ onMessage });
    const bad = "{not json";
    const good = JSON.stringify({ jsonrpc: "2.0", id: 9, method: "exit" });
    const framed =
      `Content-Length: ${Buffer.byteLength(bad)}\r\n\r\n${bad}` +
      `Content-Length: ${Buffer.byteLength(good)}\r\n\r\n${good}`;

    stream.acceptChunk(Buffer.from(framed, "utf-8"));

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: 9,
      method: "exit",
    });
  });

  it("does not buffer without bound on a hostile Content-Length", () => {
    const onMessage = vi.fn();
    const stream = createMessageStream({ onMessage });
    stream.acceptChunk(
      Buffer.from("Content-Length: 999999999999\r\n\r\nshort", "utf-8"),
    );
    // Nothing is emitted and the stream remains usable for a valid follow-up.
    const good = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "exit" });
    stream.acceptChunk(
      Buffer.from(
        `Content-Length: ${Buffer.byteLength(good)}\r\n\r\n${good}`,
        "utf-8",
      ),
    );
    expect(onMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: 1,
      method: "exit",
    });
  });

  it("writes framed responses and notifications", () => {
    const writes: string[] = [];
    const stream = createMessageStream({
      onMessage: () => {},
      write: (payload) => writes.push(payload),
    });

    stream.sendResponse(7, { ok: true });
    stream.sendNotification("window/logMessage", { type: 3, message: "hi" });

    expect(writes).toHaveLength(2);
    expect(writes[0]).toContain("Content-Length: ");
    expect(writes[0]).toContain('"id":7');
    expect(writes[1]).toContain('"method":"window/logMessage"');
  });

  it("frames a JSON-RPC error response and ignores a missing id", () => {
    const writes: string[] = [];
    const stream = createMessageStream({
      onMessage: () => {},
      write: (payload) => writes.push(payload),
    });

    stream.sendError(7, -32603, "boom");
    stream.sendError(undefined, -32603, "ignored");

    // Only the request with an id produces a frame.
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('"id":7');
    expect(writes[0]).toContain('"error":{"code":-32603,"message":"boom"}');
    expect(writes[0]).not.toContain('"result"');
  });

  it("attaches to an input stream and processes incoming Buffer chunks", () => {
    const onMessage = vi.fn();
    const listeners: Array<(chunk: Buffer) => void> = [];
    const input = {
      on: vi.fn((event: "data", listener: (chunk: Buffer) => void) => {
        if (event === "data") listeners.push(listener);
      }),
    };
    const stream = createMessageStream({ onMessage });
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "shutdown",
    });
    const framed = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;

    stream.start(input);
    listeners[0]?.(Buffer.from(framed, "utf-8"));

    expect(onMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: 1,
      method: "shutdown",
    });
  });
});

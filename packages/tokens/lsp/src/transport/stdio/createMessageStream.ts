/**
 * @note impure — reads process.stdin and writes process.stdout by default.
 */
import type { LspMessage } from "../../runtime/dispatch/types.js";

interface CreateMessageStreamOptions {
  onMessage: (message: LspMessage) => void;
  write?: (payload: string) => void;
}

interface ReadableMessageStream {
  on(event: "data", listener: (chunk: Buffer) => void): void;
}

interface MessageStream {
  acceptChunk(chunk: string | Buffer): void;
  sendNotification(method: string, params: unknown): void;
  sendResponse(id: string | number | undefined, result: unknown): void;
  sendError(
    id: string | number | undefined,
    code: number,
    message: string,
  ): void;
  start(input?: ReadableMessageStream): void;
}

/** Header/body separator (`\r\n\r\n`) as raw bytes. */
const HEADER_SEPARATOR = Buffer.from("\r\n\r\n");
/** Safety cap on a single message's byte length (guards against a hostile or
 *  corrupted `Content-Length` causing unbounded buffering). */
const MAX_CONTENT_LENGTH = 32 * 1024 * 1024; // 32 MiB

export default function createMessageStream(
  options: CreateMessageStreamOptions,
): MessageStream {
  const write =
    options.write ?? ((payload: string) => process.stdout.write(payload));
  // Accumulate raw bytes. `Content-Length` is a UTF-8 *byte* count, so the
  // buffer must be indexed and sliced by bytes — slicing a decoded string by
  // UTF-16 code units desyncs the stream on any non-ASCII content.
  let buffer: Buffer = Buffer.alloc(0);

  function acceptChunk(chunk: string | Buffer): void {
    const bytes =
      typeof chunk === "string" ? Buffer.from(chunk, "utf-8") : chunk;
    buffer = buffer.length === 0 ? bytes : Buffer.concat([buffer, bytes]);
    processBuffer();
  }

  function processBuffer(): void {
    while (true) {
      const headerEnd = buffer.indexOf(HEADER_SEPARATOR);
      if (headerEnd < 0) {
        // No complete header yet — guard against unbounded growth from a peer
        // that never sends a separator.
        if (buffer.length > MAX_CONTENT_LENGTH) buffer = Buffer.alloc(0);
        return;
      }
      // Headers are ASCII; latin1 keeps one byte == one char so the regex and
      // byte offsets stay aligned.
      const header = buffer.toString("latin1", 0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.subarray(headerEnd + HEADER_SEPARATOR.length);
        continue;
      }
      const contentLength = Number.parseInt(lengthMatch[1], 10);
      if (
        !Number.isFinite(contentLength) ||
        contentLength > MAX_CONTENT_LENGTH
      ) {
        // Malformed or hostile length — reset to attempt resync rather than
        // buffering without bound.
        buffer = Buffer.alloc(0);
        return;
      }
      const contentStart = headerEnd + HEADER_SEPARATOR.length;
      if (buffer.length < contentStart + contentLength) return;
      const content = buffer.toString(
        "utf-8",
        contentStart,
        contentStart + contentLength,
      );
      buffer = buffer.subarray(contentStart + contentLength);

      try {
        options.onMessage(JSON.parse(content) as LspMessage);
      } catch {
        // Invalid JSON — the frame's bytes are already consumed above, so
        // skipping here does not desync subsequent messages.
      }
    }
  }

  function sendNotification(method: string, params: unknown): void {
    write(frameMessage(JSON.stringify({ jsonrpc: "2.0", method, params })));
  }

  function sendResponse(
    id: string | number | undefined,
    result: unknown,
  ): void {
    if (id === undefined) return;
    write(frameMessage(JSON.stringify({ jsonrpc: "2.0", id, result })));
  }

  function sendError(
    id: string | number | undefined,
    code: number,
    message: string,
  ): void {
    if (id === undefined) return;
    write(
      frameMessage(
        JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
      ),
    );
  }

  function start(input: ReadableMessageStream = process.stdin): void {
    // Intentionally NOT calling setEncoding: we need raw Buffer chunks so the
    // byte-based framing above is correct for non-ASCII content.
    input.on("data", (chunk: Buffer) => acceptChunk(chunk));
  }

  return { acceptChunk, sendNotification, sendResponse, sendError, start };
}

function frameMessage(message: string): string {
  return `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
}

import { vi } from "vitest";
import type { LspTransport } from "../runtime/dispatch/types.js";

/** Build an `LspTransport` with `vi.fn()` stubs. */
export default function makeTransport(): LspTransport {
  return {
    sendNotification: vi.fn(),
    sendResponse: vi.fn(),
  };
}

import { describe, expect, it } from "vitest";
import getServerCapabilities from "./getServerCapabilities.js";

describe("getServerCapabilities", () => {
  it("returns the full feature set in normal mode", () => {
    const capabilities = getServerCapabilities(false);

    expect(capabilities.completionProvider).toBeDefined();
    expect(capabilities.hoverProvider).toBe(true);
    expect(capabilities.workspaceSymbolProvider).toBe(true);
  });

  it("returns a reduced feature set in degraded mode", () => {
    const capabilities = getServerCapabilities(true);

    expect(capabilities).toEqual({
      textDocumentSync: 1,
    });
  });
});

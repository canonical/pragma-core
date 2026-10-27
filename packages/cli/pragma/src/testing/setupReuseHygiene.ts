/**
 * Belt to the files' own braces: sweeps what a file in the `reused` project
 * (shared worker) might leave for the next file — leaks are visible across
 * files, so even one unrestored stub is cross-file state. All calls are
 * no-ops when nothing needs them.
 */
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Structural types: no DOM library is loaded under `environment: "node"`,
  // and these guards only need the members they touch.
  const g = globalThis as {
    document?: { documentElement?: { innerHTML: string } };
    localStorage?: { clear(): void };
  };
  if (g.document?.documentElement) {
    g.document.documentElement.innerHTML = "";
  }
  g.localStorage?.clear();
});

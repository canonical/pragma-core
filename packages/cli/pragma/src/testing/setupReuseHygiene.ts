/**
 * Per-file hygiene for files that run in the `reused` project (shared
 * workers, `isolate: false`).
 *
 * The reused project shares one worker's module registry and globals across
 * every file it runs, so any state a file leaves behind is visible to the
 * next file in that worker. Most files already clean up after themselves;
 * this setup is the belt to their braces: it runs after every test FILE in
 * the reuse project and sweeps the state classes a leaked mock, stub, timer,
 * or DOM write can leave.
 *
 * `vi.unstubAllEnvs`/`vi.unstubAllGlobals` are safe even when nothing was
 * stubbed, `restoreAllMocks` returns real implementations to spied modules,
 * and `useRealTimers` uninstalls any fake timer a file forgot. DOM and
 * storage state do not exist under this package's `environment: "node"` —
 * the `document`/`localStorage` branches are guards, not features: if the
 * project ever gains a DOM environment, the sweep already covers it.
 *
 * The `isolated` project's files need none of this (their worker is fresh
 * per file), but the setup is shared through `SHARED_TEST_OPTIONS` so the
 * two projects cannot drift in hygiene the way they could if each listed
 * its own setup files.
 */
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Structural types, not lib.dom's `Document`/`Storage`: this package has no
  // DOM library loaded (it is a `node` environment suite), and the sweep only
  // needs the two members it touches.
  const g = globalThis as {
    document?: { documentElement?: { innerHTML: string } };
    localStorage?: { clear(): void };
  };
  if (g.document?.documentElement) {
    g.document.documentElement.innerHTML = "";
  }
  g.localStorage?.clear();
});

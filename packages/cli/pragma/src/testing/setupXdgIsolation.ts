/**
 * Per-file setup: give every test FILE its own directory inside the run's
 * temp root, and isolate the mutable XDG layers (config, data, state) in it —
 * tests MUTATE and ASSERT those layers, so per-file is what keeps files from
 * observing each other's or the developer's real global state.
 *
 * THE PACK CACHE IS THE EXCEPTION — shared at the RUN level (content-addressed,
 * immutable, seeded with the embedded pack by `sharedCacheSeed.globalSetup.ts`).
 * A test needing a COLD cache overrides `XDG_CACHE_HOME` itself.
 *
 * `TMPDIR`/`TMP`/`TEMP` are redirected to this file's directory BEFORE any
 * other temp path exists, so every later `tmpdir()` consumer — the mkdtemp
 * calls in files, helpers and spawned subprocesses — lands inside the run
 * root and is removed by `tempRoot.globalSetup.ts`'s teardown. The `afterAll`
 * below only keeps peak disk flat; the run root is what makes the run clean.
 *
 * Allocate temp directories freely under `tmpdir()` — they are cleaned for
 * you. Never `mkdtempSync` at the REAL system temp directory or an absolute
 * /tmp: it escapes the run root and leaks.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll } from "vitest";
import {
  requireSharedCacheDir,
  requireTempRoot,
} from "./tempRoot.globalSetup.js";

/**
 * This test file's directory inside the run root.
 *
 * Allocated before the redirection below, so it lands in the run root rather
 * than inside itself.
 */
const fileTempDir = mkdtempSync(join(requireTempRoot(), "file-"));

// Every subsequent `tmpdir()` in this process, and in the processes it spawns,
// resolves here. Node reads these three names in this order.
process.env.TMPDIR = fileTempDir;
process.env.TMP = fileTempDir;
process.env.TEMP = fileTempDir;

// The MUTABLE layers, per file: config, data, and state.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(fileTempDir, "xdg-config-"));
process.env.XDG_DATA_HOME = mkdtempSync(join(fileTempDir, "xdg-data-"));
process.env.XDG_STATE_HOME = mkdtempSync(join(fileTempDir, "xdg-state-"));

// The pack cache, shared across the whole RUN (see the docblock above and
// `sharedCacheSeed.globalSetup.ts`): content-addressed, immutable, and seeded
// with the embedded pack before any worker started.
process.env.XDG_CACHE_HOME = requireSharedCacheDir();

/**
 * Release this file's footprint early, tolerating every failure.
 *
 * A removal that fails (a subprocess still holding a descriptor, a mode a
 * fixture made read-only) must never turn a green run red — the run root's
 * teardown collects whatever is left regardless, so there is nothing useful to
 * do here but continue.
 */
afterAll(() => {
  try {
    rmSync(fileTempDir, { recursive: true, force: true });
  } catch {
    // Deliberately swallowed; the run teardown is the backstop. See above.
  }
});

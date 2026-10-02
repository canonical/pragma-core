/**
 * Seed the run's shared pack cache with the embedded pack, in the main
 * process, before any worker starts.
 *
 * The pack cache is content-addressed and immutable, so one directory shared
 * by the whole run is sound — and per-file caches re-materialised the ~13 MB
 * embedded pack in every store-booting file. Seeding here also avoids the
 * concurrent first-materialisation race on `materializeEmbeddedPack`'s
 * check-then-rename (two miss-branch workers -> EEXIST), and keeps the one
 * payload-module evaluation out of every worker. Idempotent: the second
 * project's setup re-runs this against a complete pack and no-ops.
 *
 * Tests asserting on a COLD cache override `XDG_CACHE_HOME` with a private
 * directory (see `entitySource.test.ts`, `safety.test.ts`,
 * `graphpack.test.ts`).
 */

import { materializeEmbeddedPack } from "../kernel/runtime/graphpack/embedded.js";
import { requireSharedCacheDir } from "./tempRoot.globalSetup.js";

/**
 * Point the main process at the run's shared pack cache and seed it.
 *
 * @note Impure — writes `process.env` and materialises the embedded pack
 *   into the shared cache (a ~13 MB write on the first call per run).
 */
export default async function setup(): Promise<void> {
  process.env.XDG_CACHE_HOME = requireSharedCacheDir();
  await materializeEmbeddedPack();
}

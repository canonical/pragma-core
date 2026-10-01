/**
 * The single source of truth for which test files run in the `isolated`
 * project (per-file isolation) instead of `reused` (worker reuse).
 *
 * `vitest.config.ts` imports this list to build BOTH projects — the reuse
 * project excludes exactly these paths, the isolation project includes
 * exactly these paths — and `mockHeavyGuard.test.ts` imports it to fail the
 * run when a file that hoists `vi.mock`/`vi.hoisted` is missing from it, or
 * when an entry stops resolving to a real file.
 *
 * The files that hoist `vi.mock(...)` over modules the rest of the suite
 * imports (`pragma.conf.js`, `loadSession.js`, `ke`, `ke-graphql`,
 * `shared/index.js`). A worker shared across files keeps its module
 * registry, and a hoisted mock cannot replace a module another file in the
 * worker already evaluated — so these six must run with per-file isolation
 * while every other file reuses its worker.
 */
export const MOCK_HEAVY_FILES = [
  "src/identity.test.ts",
  "src/kernel/runtime/store.test.ts",
  "src/kernel/runtime/facade.test.ts",
  "src/kernel/completion/safety.test.ts",
  "src/capabilities/info/info.test.ts",
  "src/capabilities/upgrade/upgrade.test.ts",
] as const;

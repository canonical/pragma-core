/**
 * The files that hoist `vi.mock` over modules the rest of the suite imports
 * (`pragma.conf.js`, `loadSession.js`, `ke`, `ke-graphql`, `shared/index.js`).
 * A hoisted mock cannot replace a module another file in a shared worker
 * already evaluated, so these run with per-file isolation; every other file
 * reuses its worker.
 *
 * The single source for BOTH projects in `vitest.config.ts` (reused excludes
 * it, isolated includes it) and for `mockHeavyGuard.test.ts`'s checks.
 */
export const MOCK_HEAVY_FILES = [
  "src/identity.test.ts",
  "src/kernel/runtime/store.test.ts",
  "src/kernel/runtime/facade.test.ts",
  "src/kernel/completion/safety.test.ts",
  "src/capabilities/info/info.test.ts",
  "src/capabilities/upgrade/upgrade.test.ts",
] as const;

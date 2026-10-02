import type { ViteUserConfig } from "vitest/config";
import { configDefaults, defineConfig } from "vitest/config";

import { MOCK_HEAVY_FILES } from "./src/testing/mockHeavyFiles.js";

/** The `test` block of a Vitest config, as consumed by `defineConfig({ test })`. */
type TestConfig = NonNullable<ViteUserConfig["test"]>;

/**
 * What every project shares. Vitest 5 inline projects inherit the root
 * config's test options and CONCATENATE root arrays, so no test options live
 * at the root — the root holds only `coverage`, which merges both projects'
 * results into the one threshold gate.
 */
const SHARED_TEST_OPTIONS: TestConfig = {
  globals: true,
  environment: "node",
  // Spawn-heavy suite: 25 s sits above runCli's 20 s kill budget, so a slow
  // spawn reports the helper's diagnosis instead of a bare clock. Only cells
  // needing longer (60 s pack builder, 120 s perf harness) name a number.
  testTimeout: 25_000,
  globalSetup: [
    "./src/testing/perf/globalSetup.ts",
    "./src/testing/tempRoot.globalSetup.ts",
    "./src/testing/sharedCacheSeed.globalSetup.ts",
  ],
  setupFiles: [
    "./src/testing/setupXdgIsolation.ts",
    "./src/testing/setupCallChecking.ts",
    "./src/testing/setupOfflineRegistry.ts",
    "./src/testing/setupReuseHygiene.ts",
  ],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "reused",
          ...SHARED_TEST_OPTIONS,
          // Worker reuse: the per-file fork respawn is pure overhead;
          // subprocess-spawning tests fork their own children, and the
          // per-file setup files still re-run per file.
          isolate: false,
          // The perf-budget TIMING tests run in their own SERIAL pass
          // (`test:perf`, vitest.perf.config.ts) — timing inside this
          // parallel, coverage-instrumented run measures contention, not the
          // binary. safety.test.ts's correctness guards stay here, and the
          // perf globalSetup provisions the emit if missing.
          include: ["src/**/*.test.ts"],
          exclude: [
            ...configDefaults.exclude,
            "src/testing/perf/**",
            ...MOCK_HEAVY_FILES,
          ],
        },
      },
      {
        test: {
          name: "isolated",
          ...SHARED_TEST_OPTIONS,
          // Per-file isolation for the hoisted-mock files (MOCK_HEAVY_FILES).
          isolate: true,
          include: [...MOCK_HEAVY_FILES],
          exclude: [...configDefaults.exclude],
        },
      },
    ],
    // Coverage is a ROOT-level option: with projects, the results are merged
    // across both and these thresholds gate the one merged report.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "**/index.ts",
        "**/*.test.ts",
        "**/*.d.ts",
        "**/types.ts",
        "**/bin.ts",
        "src/testing/**",
        // The embedded pack's generated modules are inlined DATA, not
        // logic; the shared-cache seed keeps them out of the workers.
        "src/kernel/runtime/graphpack/embedded/**",
      ],
      // Ratcheted to the measured floor, rounded down. The gate sat at 50
      // while the suite really covered ~90, so forty points of headroom meant
      // any amount of new code could arrive uncovered and CI would say
      // nothing. These numbers move UP when a run beats them; they are not a
      // target to code down to.
      thresholds: {
        statements: 90,
        branches: 81,
        functions: 92,
        lines: 91,
      },
    },
  },
});

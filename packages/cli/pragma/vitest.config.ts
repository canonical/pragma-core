import type { ViteUserConfig } from "vitest/config";
import { configDefaults, defineConfig } from "vitest/config";

import { MOCK_HEAVY_FILES } from "./src/testing/mockHeavyFiles.js";

/** The `test` block of a Vitest config, as consumed by `defineConfig({ test })`. */
type TestConfig = NonNullable<ViteUserConfig["test"]>;

/**
 * What every project in this config shares.
 *
 * Vitest 5 inline projects inherit the root config's test options and
 * CONCATENATE its arrays (`include`/`exclude`), so this config keeps NO test
 * options at the root: each option is spelled once here and spread into both
 * projects, and the root holds only `coverage` — a root-level option that
 * merges both projects' results into the one threshold gate. Nothing can
 * concatenate, inherit, or drift between the two projects by accident.
 *
 * globalSetup is spread into both projects: both projects' workers spawn the
 * shipped entry and allocate inside the run root, so both need the emit
 * gate, the run-level temp root (which is REFCOUNTED for exactly this
 * two-holder case), and the shared-cache seed.
 */
const SHARED_TEST_OPTIONS: TestConfig = {
  globals: true,
  environment: "node",
  maxWorkers: "100%",
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
          // Worker reuse across test files: the per-file fork respawn is pure
          // overhead this suite paid ~170 times per run. Subprocess-spawning
          // tests are unaffected (they fork their own children), and the
          // per-file setup files — XDG isolation included — still re-run per
          // file.
          isolate: false,
          // The perf-budget TIMING tests (src/testing/perf/**) are isolated
          // into their own SERIAL pass (vitest.perf.config.ts / the
          // `test:perf` script): spawning + timing the shipped entry inside
          // this parallel, coverage-instrumented run measures CPU contention,
          // not the binary, so the ceilings flake red. They stay ENFORCED,
          // just out of this pass.
          //
          // safety.test.ts's storeless-guarantee guards spawn the shipped
          // entry — a correctness check (exit/stdout), not a timing one, so
          // it belongs in this pass. The perf suite's globalSetup provisions
          // the emit once if missing so a clean `test:vitest` doesn't fail
          // with a null exit status.
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
          // Per-file isolation for the hoisted-mock files (see
          // MOCK_HEAVY_FILES). The same maxWorkers as the reuse project keeps
          // both in one scheduling group — vitest refuses two projects that
          // share a group order but disagree on the worker cap.
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
        // The embedded pack's generated modules are DATA, not logic: an
        // 11.4 MB n-quads payload inlined as a string literal (~5 statements
        // across four files) that the shared-cache seed keeps out of the
        // workers entirely. Counting them made the v8 report parse and remap
        // 13 MB of generated text per run for no measurement it can use.
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

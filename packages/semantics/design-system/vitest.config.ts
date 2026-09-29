import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  // Base the test config on the base vite config
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: "v8",
        // Org convention (pragma packages + cs:testing.coverage.config): whole
        // domain under a 100% gate, with the standard barrel/type/test excludes.
        // Scoped to the `sync` domain plus the fail-closed pull-sync guard
        // modules — the rest of src predates the standard and ratchets up
        // separately.
        include: [
          "src/sync/**/*.ts",
          "src/commands/sync.ts",
          "src/scripts/evaluateDataDeletion.ts",
          "src/transform/classifySubjectUri.ts",
          "src/transform/collectDataMetrics.ts",
          "src/transform/deltaGuards.ts",
          "src/transform/expectedTables.ts",
          "src/transform/reportFilteredRows.ts",
          "src/transform/rowFilter.ts",
          // The token-binding derivation, the law that reads it and the two
          // committed inputs the law gathers are new work, so they go where the gate
          // already reaches. `src/commands/transform.ts` deliberately stays out — it
          // predates the standard and ratchets up separately, and this adds one call
          // to it.
          "src/transform/tokenBindings.ts",
          "src/transform/bindingGuard.ts",
          "src/transform/symbols.ts",
          "src/anatomies/**/*.ts",
          "src/commands/anatomies.ts",
        ],
        exclude: [
          "**/index.ts",
          "**/*.tests.ts",
          "**/*.test.ts",
          "**/*.d.ts",
          "**/types.ts",
        ],
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
      projects: [
        {
          test: {
            name: "client",
            // include vite globals for terser test code
            globals: true,
            include: ["src/**/*.tests.ts"],
            // A handful of tests run a command over the whole committed corpus — 180
            // anatomies read from `data/`, the token strata loaded, the law run — and
            // each takes seconds. That is close enough to the 5s default to time out
            // on a loaded machine under coverage instrumentation, which is a fact
            // about the machine and not about the assertion, so the ceiling is raised
            // rather than the tests being made to lie about what they cover.
            testTimeout: 30_000,
          },
        },
      ],
    },
  }),
);

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Worker reuse across files; the per-file fork respawn is pure overhead.
    isolate: false,
    // The full monorepo run multiplies the runner's concurrency by this cap;
    // half the cores bounds the fan-out without costing these suites wall clock.
    maxWorkers: "50%",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["**/index.ts", "**/*.test.ts", "**/*.d.ts", "**/types.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});

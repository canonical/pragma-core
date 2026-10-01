import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Worker reuse across files; the per-file fork respawn is pure overhead.
    isolate: false,
    // The full monorepo run multiplies the runner's concurrency by this cap;
    // half the cores bounds the fan-out without costing these suites wall clock.
    maxWorkers: "50%",
    // The React application template ships its own `*.test.ts(x)` files. They
    // run inside a generated application, never as this package's tests.
    exclude: [...configDefaults.exclude, "src/application/react/templates/**"],
  },
});

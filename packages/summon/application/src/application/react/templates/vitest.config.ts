import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

// `vite.config` is a config function (it branches on `--mode server` for the
// SSR build); resolve it for the default test run before merging.
export default mergeConfig(
  viteConfig({ command: "serve", mode: "test" }),
  defineConfig({
    // Vitest resolves dependencies the way Node does, which ignores a
    // package's "module" entry; some @canonical/* packages declare only that
    // entry (no "main"/"exports"), so a test that imports the route map (and
    // through it every page) could not resolve them without this.
    resolve: { mainFields: ["module"] },
    test: {
      // Browser-like environment for component tests
      environment: "jsdom",
      // Transform @canonical/* through Vite rather than loading them with
      // Node: their built output imports CSS as a side effect, which Node
      // cannot load. The same reason vite.config.ts bundles them for SSR.
      server: { deps: { inline: [/@canonical\//] } },
      // Vitest globals (describe/it/expect) without imports
      globals: true,
      // Extend matchers and clean up the DOM between tests
      setupFiles: ["./vitest.setup.ts"],
      // Unit and component tests are colocated and named *.test.ts(x)
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      coverage: {
        provider: "v8",
        // Thresholds start at 0 — coverage is reported but does not gate.
        // Ratchet these up as the app grows.
        thresholds: {
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0,
        },
      },
    },
  }),
);

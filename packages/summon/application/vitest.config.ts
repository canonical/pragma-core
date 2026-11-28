import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The application templates ship their own `*.test.ts(x)` files. They run
    // inside a generated application, never as this package's tests.
    exclude: [...configDefaults.exclude, "src/application/*/templates/**"],
  },
});

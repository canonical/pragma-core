import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.tests.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.tests.ts", "src/**/index.ts"],
    },
  },
});

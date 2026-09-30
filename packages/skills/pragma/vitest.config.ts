import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The examples are checked against the token strata, which take seconds to
    // parse on a loaded machine, close to the 5s default.
    testTimeout: 30_000,
  },
});

# Preface

The performance budgets of the `pragma` command-line tool: what they measure, how to run them, and why they are kept off CI. Read this before changing the perf tests, a CI target, or a script chain in `packages/cli/pragma`.

Read the top-level `.kb/agents.md` file before continuing below.

# Overview

The protected perf tests in `packages/cli/pragma/src/testing/perf/` spawn the shipped entry the way a consumer does (`node dist/src/bin.js`), discard warm-up runs, and assert the median and 95th percentile against the ceilings in `src/testing/perf/budgets.ts`. [`packages/cli/pragma/BUDGETS.md`](../packages/cli/pragma/BUDGETS.md) explains the budgets and how they were derived.

# Important

- **The perf pass runs only through `bun run test:perf`** in `packages/cli/pragma`. It runs the perf tests alone, serially, in a single fork, with no coverage instrumentation, because spawn latency measured under a loaded, instrumented test suite measures the test runner rather than the binary. It also needs a quiet machine: under other load, spawn latency inflates two to three times.
- **The perf pass is kept off CI, and it gates no pull request.** No workflow names `test:perf` or `vitest.perf.config.ts`, the package's `test` script does not chain it, `vitest.config.ts` excludes `src/testing/perf/**`, and `nx.json` declares no perf target. The ceilings do not hold on the hosted runners that would enforce them.
- **Do not put the pass back on a CI target.** A job, step, Nx target or script chain that would reach it reverses that decision: say so in the pull request body and expect it to be challenged (`.kb/ci.md`).

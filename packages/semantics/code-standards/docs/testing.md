# Testing Standards

Standards for testing development.

> **Scope:** Currently targets TypeScript/JavaScript projects.

## Colocate tests with source

**Identifier:** `cs:testing.file.structure`

Unit test files must be colocated with the source they test, using the `.test.ts` suffix (`.test.tsx` for component tests). Other test types (browser, e2e) may follow different naming conventions. Shared test infrastructure — fixtures, factory helpers, custom matchers, type definitions — lives in a `testing/` directory at the package root (not inside `src/`). This directory is excluded from coverage and from the package's public API. Integration tests that exercise multiple modules together go in `src/testing/integration/`. Do not place test files in a top-level `__tests__/` or `tests/` directory mirroring the source tree. Do not use `.spec.ts` — the convention is `.test.ts`.

### Do

Colocate test files next to the source they test, with shared infrastructure in `testing/`.
```
packages/my-package/
├── src/
│   ├── parseThing.ts
│   ├── parseThing.test.ts        # colocated with source
│   ├── formatThing.ts
│   └── formatThing.test.ts
├── testing/
│   ├── fixtures.ts               # shared test data
│   ├── createTestDb.ts             # factory helpers
│   ├── registerMatchers.ts        # custom vitest matchers
│   └── types.ts                   # test-only type definitions
└── vitest.config.ts
```

Place integration tests in `src/testing/integration/`.
```
packages/my-package/
├── src/
│   ├── testing/
│   │   └── integration/
│   │       └── checkout-flow.test.ts
```

### Don't

Place test files in a separate `__tests__/` or `tests/` directory mirroring the source tree, or use `.spec.ts`.
```
packages/my-package/
├── src/
│   ├── parseThing.ts
│   └── formatThing.ts
├── __tests__/                    # Bad: mirrored directory
│   ├── parseThing.spec.ts        # Bad: .spec.ts suffix
│   └── formatThing.spec.ts
```

---

# Coverage

> **Scope:** Targets TypeScript/JavaScript projects using vitest and the V8 coverage provider.

## Enforce 100% coverage

**Identifier:** `cs:testing.coverage.config`

New packages with runtime code must enforce 100% coverage thresholds using vitest with the v8 provider. Existing packages should ratchet toward 100% over time. Every package that exports runtime code (not pure types or CSS) must configure vitest coverage. The `test:coverage` script in `package.json` runs `vitest run --coverage`. The plain `test` script runs `vitest run` without coverage for speed during development. Package-specific exclusions are acceptable when justified (e.g., `**/types/*.ts` for packages with type directories, third-party wrappers). Each addition to `exclude` must be a category of non-runtime code, not a way to skip hard-to-test source.

### Do

Configure vitest with v8 coverage provider and 100% thresholds with standard exclusions.
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "**/index.ts",       // barrel re-exports
        "**/*.test.ts",      // test files
        "**/*.test.tsx",     // component test files
        "**/*.d.ts",         // type declarations
        "**/types.ts",       // type-only files
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
```

### Don't

Omit coverage thresholds or use thresholds below 100%.
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Bad: no thresholds — coverage is informational only
    },
  },
});
```

Add source files to `exclude` to avoid writing tests for them.
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/hardToTest.ts",   // Bad: skipping testable source
        "src/legacy/**/*.ts",  // Bad: blanket exclusion of source
      ],
    },
  },
});
```

---

## Ignore only unreachable branches

**Identifier:** `cs:testing.coverage.ignore_pragma`

`v8 ignore` pragmas must be reserved for structurally unreachable branches, not testable-but-inconvenient code. Acceptable uses include: runtime detection (`typeof Bun !== "undefined"`), environment variables (`process.env.HOME ?? ""`), exhaustive switch defaults after all discriminated union members are handled, and intentional no-ops (empty callback functions passed to framework APIs). Unacceptable uses include: `?? ""` on `Map.get()` where the key was conditionally set, `if (!x)` guard after a length check, and `error instanceof Error` in catch blocks. Each pragma must include a `--` comment explaining why the branch is unreachable.

### Do

Include a `--` comment explaining why the branch is structurally unreachable.
```typescript
/* v8 ignore next 7 -- Bun.Glob branch; only reachable under Bun runtime */
if (typeof Bun !== "undefined" && Bun.Glob) {
  // Bun-specific glob implementation
}
```

Use `v8 ignore` for exhaustive switch defaults that TypeScript guarantees are unreachable.
```typescript
switch (kind) {
  case "add": return handleAdd(effect);
  case "remove": return handleRemove(effect);
  /* v8 ignore next -- exhaustive: all EffectKind members handled above */
  default: return false;
}
```

### Don't

Use `v8 ignore` without an explanation, or to suppress a testable branch.
```typescript
/* v8 ignore next */
if (modified) { result = modified; }
```

---

# Integration Testing

> **Scope:** Targets TypeScript/JavaScript projects.

## Test outcomes, not wiring

**Identifier:** `cs:testing.integration.structure`

Integration tests that exercise multiple modules together must live in `src/testing/integration/` and test observable outcomes, not internal wiring. Integration tests verify that modules compose correctly — that a pipeline produces the right output, that a query returns the right results, that a template renders with all helpers available. They must use real implementations (not mocks), be named after the capability they verify (not the modules they touch), and clean up any state they create. Do not place integration tests next to unit tests without the `integration/` directory. Do not test cross-package integration in library packages — that belongs at the application layer.

### Do

Place integration tests in `src/testing/integration/` and test observable outcomes.
```typescript
// src/testing/integration/checkout-flow.test.ts
describe("checkout flow", () => {
  it("applies discount and calculates correct total", () => {
    const cart = createCart([{ sku: "A1", qty: 2, price: 50 }]);
    applyDiscount(cart, "SAVE10");
    const receipt = checkout(cart);
    expect(receipt.total).toBe(90);
  });
});
```

### Don't

Place integration tests next to unit tests or test internal wiring instead of outcomes.
```typescript
// Bad: integration test sitting next to unit tests
// src/checkout/checkout.integration.test.ts

// Bad: testing internal wiring instead of outcomes
it("calls validateCart then applyDiscount then chargePayment", () => {
  const spy1 = vi.spyOn(mod, "validateCart");
  const spy2 = vi.spyOn(mod, "applyDiscount");
  checkout(cart);
  expect(spy1).toHaveBeenCalledBefore(spy2);
});
```

---

# Regression Testing

> **Scope:** Targets TypeScript/JavaScript projects.

## Numbered regression test registry

**Identifier:** `cs:testing.regression.structure`

A regression test pins a specific, once-broken behaviour so it can never silently return. Regression tests are numbered by landing order and live in `src/testing/regression/`, named `NNNN-slug.test.ts` — a zero-padded sequence number plus a kebab-case slug describing the bug. The number is a permanent, monotonic record: the filename itself is the registry, so there is no counter file. A regression pins cross-cutting behaviour rather than one source file, so it is not colocated as a unit test; it sits alongside the integration tests under `src/testing/`. Reproduce the original failure with real implementations (not mocks), and keep the test passing on every run.

### Do

Place numbered regression reproducers in `src/testing/regression/`, named `NNNN-slug.test.ts`.
```
packages/my-package/
├── src/
│   ├── parseThing.ts
│   ├── parseThing.test.ts
│   └── testing/
│       ├── integration/
│       │   └── checkout-flow.test.ts
│       └── regression/
│           ├── 0001-empty-cart-crash.test.ts
│           ├── 0002-discount-rounding.test.ts
│           └── 0003-duplicate-charge.test.ts
```

Number by landing order, zero-padded, with a descriptive kebab slug — the filename is the record.
```
0001-empty-cart-crash.test.ts        # first regression pinned
0002-discount-rounding.test.ts       # second
0003-duplicate-charge.test.ts        # third
```

### Don't

Colocate a cross-cutting reproducer next to a single source file as if it were a unit test.
```
// Bad: a cross-cutting reproducer masquerading as a unit test
src/checkout/checkout.empty-cart-crash.test.ts
```

Use unnumbered or vague names that lose the landing-order record.
```
// Bad: no number, no order, no description of the bug
src/testing/regression/crash.test.ts
src/testing/regression/bugfix.test.ts
```

---

# Test Performance

> **Scope:** Targets TypeScript/JavaScript projects using vitest in a monorepo where many packages run tests at once.

## happy-dom by default, jsdom per file

**Identifier:** `cs:testing.performance.happy_dom_default`

DOM suites default to happy-dom and pin the devDependency to an exact version — a caret resolved to one that broke lit's `adoptedStyleSheets`. A file that strictly needs jsdom keeps it with exactly `// @vitest-environment jsdom` on its first line; the docblock overrides the project environment and CLI flags. Typical strict needs: CSSOM style normalization, cookie-jar semantics, the matchMedia surface, `<details>`/`<summary>` toggling, `setSelectionRange` on an unfocused input.

### Do

Run the suite on happy-dom with an exact pin; keep jsdom per file.
```typescript
// vitest.config.ts — the suite default.
export default defineConfig({ test: { environment: "happy-dom" } });
// package.json — exact pin, not a caret: "happy-dom": "20.8.9"

// Button.tests.tsx — a file that strictly needs jsdom:
// @vitest-environment jsdom
import { render } from "@testing-library/react";
```

### Don't

Keep the whole suite on jsdom because one file needs it, or float the version.
```typescript
// Bad: the whole suite pays jsdom's boot cost for one file's CSSOM assertion.
export default defineConfig({ test: { environment: "jsdom" } });
```

---

## Classify files for worker reuse in the mock preference order

**Identifier:** `cs:testing.performance.isolation_classification`

A file may run in `reused` only if it does none of: hoisted `vi.mock`/`vi.hoisted`; unrestored `vi.stubGlobal`/`vi.stubEnv`; module-level mutable state; prototype patching; `process` listeners; unrestored fake timers; DOM or storage state left behind. To qualify an otherwise-disqualified file, use in order: dependency injection or pure functions; a `vi.spyOn` on the real module, restored after each test; otherwise the mock-heavy list. Treat `vi.doMock` as isolated unless nothing else imports the mocked module's consumers. A file mixing mock-heavy and clean tests splits into `.shared`/`.isolated` siblings. A shared setup file restores mocks, stubs, timers and globals after every test.

### Do

Prefer injection, then a restored spy, before the mock-heavy list.
```typescript
// (1) Injection — no module registry to fight over.
render(<Clock now={() => new Date("2024-01-01")} />);

// (2) Restored spy on the real module.
afterEach(() => vi.restoreAllMocks());
vi.spyOn(client, "fetch").mockRejectedValueOnce(new Error("boom"));
```

### Don't

Leave a hoisted mock or an unrestored stub in a file that runs on a shared worker.
```typescript
// Bad: both leak to the next file in the worker.
vi.mock("./loadSession.js", () => ({ loadSession: vi.fn() }));
it("reads the flag", () => {
  vi.stubEnv("PRAGMA_COMPLETE_DEBUG", "1"); // never restored
});
```

---

## vi.resetModules is not mock cleanup

**Identifier:** `cs:testing.performance.reset_modules_not_mock_cleanup`

`vi.resetModules()` clears the module registry — the next import re-evaluates the module — but not the mock registry: under `isolate: false` a mock still leaks into files that share a transitively imported module. Use it only for a fresh module instance in a file that mocks nothing. Mock cleanup is `vi.restoreAllMocks()` (spies), `vi.unstubAllEnvs()`/`vi.unstubAllGlobals()` (stubs), or per-file isolation (hoisted mocks).

### Do

Use resetModules for a fresh module instance, and clean mocks separately.
```typescript
it("renders without the suite's checking hooks", async () => {
  vi.resetModules();
  const fresh = await import("./call.js"); // fresh instance, no mocks
  expect(fresh.renderCall({ verb: "widget list" })).toBeDefined();
});
```

### Don't

Reach for resetModules to clean up a mock.
```typescript
// Bad: the hoisted mock of ./loadSession.js still answers the next file
// that transitively imports it.
vi.mock("./loadSession.js", () => ({ loadSession: vi.fn() }));
afterEach(() => vi.resetModules());
```

---

## Verify a reuse change against a baseline

**Identifier:** `cs:testing.performance.verification_protocol`

A passing run is not proof. Measure wall clock, peak memory, worker count, and test and coverage numbers before and after. Confirm membership: every file in exactly one project, union = all files, overlap = none. Run the reuse project shuffled on two seeds — a file whose outcome depends on file order has a leak, not a flake. Confirm per-file environment overrides beat CLI flags. Re-run on a quiet host before judging a failure: only one that survives a quiet rerun is real.

### Do

Run the protocol before merging the change.
```bash
/usr/bin/time -v vitest run --coverage      # before AND after
vitest list --filesOnly --project reused    # union = all files, overlap = none
vitest run --project reused --sequence.shuffle --sequence.seed=101
vitest run --project reused --sequence.shuffle --sequence.seed=202
vitest run --environment happy-dom <jsdom-file>  # the docblock must win
```

### Don't

Accept a green run as proof, or judge a failure from one run under external load.
```typescript
// Bad: it passed, so the split is safe — no membership, shuffle or
// before/after memory comparison was made.
```

---

## Cap test workers explicitly

**Identifier:** `cs:testing.performance.worker_caps`

Every vitest config sets `maxWorkers` explicitly. In a monorepo whose test command fans out across packages, the worst case is the runner's package concurrency multiplied by each package's cap — an unset cap defaults to every core. `"50%"` bounds the fan-out without costing wall clock; all projects in a config share the same cap so vitest schedules them in one group. Cap the package configs, never the runner (lerna.json).

### Do

Set the same cap in every project of the config.
```typescript
// vitest.config.ts — every project shares the cap.
const SHARED = { maxWorkers: "50%" };
// Worst case on a 16-core host with 16-way runner concurrency: 128, not 256.
```

### Don't

Leave maxWorkers unset, or cap the runner instead of the workers.
```typescript
// Bad: every core, multiplied by every package testing at once.
export default defineConfig({ test: { globals: true } });
```

---

## Reuse workers behind a hoisted-mock split

**Identifier:** `cs:testing.performance.worker_reuse`

Suites without per-file isolation needs split into two projects driven by ONE mock-heavy list: a `reused` project (`isolate: false`) excluding the list, an `isolated` project including exactly it — a hoisted `vi.mock` cannot replace a module another file in the shared worker already evaluated. The list is the single source for both projects; a guard test fails the run when a hoisting file is missing from it or an entry stops resolving. Spawn-heavy suites set a suite-wide `testTimeout` above the helper's kill budget. On vitest 5 keep no root test options: inline projects inherit them and concatenate root arrays.

### Do

Define both projects from one exported list; keep only coverage (a root-level option) at the root.
```typescript
// src/testing/mockHeavyFiles.ts — one list drives BOTH projects.
export const MOCK_HEAVY_FILES = ["src/store.test.ts"] as const;

// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      { test: { name: "reused", ...shared, isolate: false,
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...MOCK_HEAVY_FILES] } },
      { test: { name: "isolated", ...shared, isolate: true, include: [...MOCK_HEAVY_FILES] } },
    ],
    coverage: { provider: "v8" }, // root-level: merges both projects
  },
});
```

### Don't

Put test options at the root of a projects config on vitest 5.
```typescript
// Bad: inline projects INHERIT root options and CONCATENATE root arrays —
// the root include silently reaches every project.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    projects: [{ test: { name: "isolated", isolate: true } }],
  },
});
```

---

# Unit Testing

> **Scope:** Targets TypeScript/JavaScript projects using vitest.

## Describe blocks mirror the API

**Identifier:** `cs:testing.unit.describe_organization`

Test files must use hierarchical `describe` blocks that mirror the module's public API. Each exported function or behavior gets its own `describe`. The top-level `describe` names the module under test. Nested `describe` blocks group by exported function, method, or logical behavior. Individual `it` blocks describe specific input/output scenarios. For files that export multiple functions, use a top-level `describe` per export. Do not use `test()` as a synonym for `it()` — use `it()` consistently. Do not create deeply nested describe trees (3+ levels) — flatten by splitting into separate describe blocks or separate test files.

### Do

Use hierarchical `describe` blocks mirroring the module's public API.
```typescript
// parseThing.test.ts
describe("parseThing", () => {
  describe("with valid input", () => {
    it("parses a simple value", () => { /* ... */ });
    it("handles optional fields", () => { /* ... */ });
  });

  describe("with invalid input", () => {
    it("throws on empty string", () => { /* ... */ });
    it("throws on malformed structure", () => { /* ... */ });
  });

  describe("edge cases", () => {
    it("handles unicode characters", () => { /* ... */ });
    it("handles maximum length input", () => { /* ... */ });
  });
});
```

Use a top-level `describe` per export when a file exports multiple functions.
```typescript
// formatEffects.test.ts
describe("formatLogEffect", () => { /* ... */ });
describe("formatPromptEffect", () => { /* ... */ });
describe("formatFileEffect", () => { /* ... */ });
```

### Don't

Use `test()` instead of `it()`, or create deeply nested describe trees.
```typescript
// Bad: mixing test() and it(), deeply nested
describe("parseThing", () => {
  describe("valid", () => {
    describe("simple", () => {
      describe("strings", () => {
        test("parses a string", () => { /* ... */ }); // Bad: test() instead of it()
      });
    });
  });
});
```

---

## Fixtures live in testing/

**Identifier:** `cs:testing.unit.fixtures_pattern`

Test fixtures must be defined in `testing/fixtures.ts` as named exports. Factory helpers that create stateful test objects get their own files in `testing/`. Static test data (strings, objects, configuration samples) belongs in `testing/fixtures.ts`. Custom vitest matchers go in `testing/registerMatchers.ts`. Test-only type definitions go in `testing/types.ts`. Do not inline large fixture data in test files. Do not use JSON fixture files — TypeScript exports are type-safe and importable.

### Do

Define static fixtures as named exports in `testing/fixtures.ts`.
```typescript
// testing/fixtures.ts
export const testUser: User = {
  id: "user-1",
  name: "Alice",
  role: "admin",
};

export const validConfigYaml = `
  host: localhost
  port: 3000
  debug: true
`;

export const multiServerConfig = {
  servers: [{ name: "a" }, { name: "b" }],
};
```

Place factory helpers that create stateful objects in their own files in `testing/`.
```typescript
// testing/createTestDb.ts
export function createTestDb(seed: Record<string, unknown>[]): Database {
  const db = new Database(":memory:");
  for (const row of seed) db.insert(row);
  return db;
}
```

### Don't

Inline large fixture data directly in test files or use JSON fixture files.
```typescript
// Bad: large fixture inlined in test file
const seedData = [
  { id: "1", name: "Alice", role: "admin" },
  { id: "2", name: "Bob", role: "editor" },
  { id: "3", name: "Carol", role: "viewer" },
  // ... 50 more rows ...
];

// Bad: JSON fixture file instead of typed TypeScript export
import fixture from "../fixtures/config.json";
```

---

## Mock only at boundaries

**Identifier:** `cs:testing.unit.mocking_minimal`

Prefer real execution over mocks. Mock only at system boundaries where real execution is impossible or destructive. Mocking internal modules to simplify test setup produces tests that pass when the contract is broken. Acceptable mocking targets: filesystem (`node:fs/promises`), network (HTTP clients, external API calls), process/runtime (`process.exit`), and time (`vi.useFakeTimers()`). Mocking internal modules is acceptable when needed to trigger specific edge cases (error paths, race conditions) that are impractical to reproduce otherwise. Avoid mocking: pure functions, configuration/constants, or other packages in the monorepo.

### Do

Use a factory helper to create real test dependencies instead of mocking them.
```typescript
// testing/createTestDb.ts
export function createTestDb(seed: Record<string, unknown>[]): Database {
  const db = new Database(":memory:");
  for (const row of seed) db.insert(row);
  return db;
}
```

Mock only at genuine system boundaries like the filesystem.
```typescript
import { vi } from "vitest";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

it("discovers config files in directory", async () => {
  vi.mocked(fs.readdir).mockResolvedValue(["config.json", "README.md"]);
  const configs = await discoverConfigs("/app");
  expect(configs).toEqual(["config.json"]);
});
```

### Don't

Mock internal modules within the same package to simplify test setup.
```typescript
// Bad: mocking an internal module hides contract breakage
vi.mock("./parseConfig");
vi.mocked(parseConfig).mockReturnValue({ host: "localhost" });

it("uses parsed config", () => {
  const result = buildConnection();
  // This test passes even if parseConfig's real output changes
  expect(result.host).toBe("localhost");
});
```

---

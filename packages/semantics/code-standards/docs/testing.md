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

# Performance Considerations in Testing

> **Scope:** Targets TypeScript/JavaScript projects using vitest in a monorepo where many packages run tests at once.

## happy-dom by default, jsdom per file only

**Identifier:** `cs:testing.performance.happy_dom_default`

DOM test suites run on happy-dom as the environment default: it boots and runs materially lighter and faster than jsdom (measured on the heaviest DOM suite in the monorepo: 18.1 s to 6.4 s wall for the same 101 files and 580 tests). happy-dom is pinned to an exact patched version (20.8.9) — a caret silently resolved to 20.14.5, which broke lit's `adoptedStyleSheets` under vitest's environment adapter, so the caret is deliberately avoided. A file that strictly needs jsdom keeps it per file with exactly the `// @vitest-environment jsdom` docblock on the first line; the docblock beats the project environment and the CLI flag. Confirmed jsdom-inherent needs: CSSOM style normalization (`color: red` read back as `rgb(255, 0, 0)`), `document.cookie` jar semantics (overwrite and clear), the `matchMedia` override surface, `<details>`/`<summary>` toggle behaviour (happy-dom toggles natively; jsdom does not, which is what a disabled-guard test observes), and `setSelectionRange` on an unfocused input.

### Do

Run the suite on happy-dom and declare the pinned devDependency; keep jsdom per file where strictly needed.
```typescript
// vitest.config.ts — the suite default.
export default defineConfig({
  test: { environment: "happy-dom" },
});

// package.json — pinned, not a caret: 20.14.5 broke lit's
// adoptedStyleSheets under the vitest environment adapter.
// "happy-dom": "20.8.9"

// src/lib/component/Button/Button.tests.tsx — a file that strictly needs
// jsdom's CSSOM normalization keeps it with exactly this first line:
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
```

### Don't

Keep the whole suite on jsdom because one file needs it, or let the happy-dom version float.
```typescript
// Bad: package-wide jsdom for one file's CSSOM assertion.
export default defineConfig({
  test: { environment: "jsdom" }, // the whole suite pays for one file
});

// Bad: a caret can resolve to a version that breaks the suites.
// "happy-dom": "^20.8.9"   // silently became 20.14.5 and broke lit
```

---

## Classify files for worker reuse, in the mock preference order

**Identifier:** `cs:testing.performance.isolation_classification`

A file may run in the worker-reuse project only if it does none of: hoisted `vi.mock`/`vi.hoisted`; `vi.stubGlobal`/`vi.stubEnv` without restoration; module-level mutable state; prototype patching; listeners on `process`; fake timers it does not restore; leaving DOM or storage state behind. To get an otherwise-disqualified file into reuse, use in order: (1) dependency injection or pure functions; (2) `vi.spyOn` on the real module or object, restored after each test (`vi.restoreAllMocks`); (3) otherwise add the file to the mock-heavy list and let it run isolated. Treat `vi.doMock` as needing isolation unless shown that nothing else imports the mocked module's consumers. A file that mixes mock-heavy and clean tests splits into a `.shared.test.ts` (clean) and an `.isolated.test.ts` (mock-heavy) pair. A shared setup file cleans DOM, storage, timers and globals after every test in the reuse project — per-file cleanup stays primary, the sweep is the belt to its braces.

### Do

Prefer injection, then a restored spy on the real module, before reaching for the mock-heavy list.
```typescript
// (1) Injection: pass the seam in, no module registry to fight over.
it("renders with the injected clock", () => {
  render(<Clock now={() => new Date("2024-01-01")} />);
});

// (2) Restored spy: the real module stays in the shared worker's registry.
afterEach(() => vi.restoreAllMocks());
it("retries on failure", async () => {
  vi.spyOn(client, "fetch").mockRejectedValueOnce(new Error("boom"));
  await expect(run()).resolves.toBeDefined();
});
```

Restore everything a file stubs, and sweep the rest in a shared reuse setup.
```typescript
// src/testing/setupReuseHygiene.ts — runs after every test in `reused`.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.documentElement.innerHTML = "";
  localStorage.clear();
});
```

### Don't

Hoist a mock, stub a global without restoring it, or leave module-level state in a file that runs on a shared worker.
```typescript
// Bad: a hoisted mock over a module other files import — belongs in
// MOCK_HEAVY_FILES, or reworked per the preference order.
vi.mock("./loadSession.js", () => ({ loadSession: vi.fn() }));

// Bad: stubbed without restoration — leaks to the next file in the worker.
it("reads the flag", () => {
  vi.stubEnv("PRAGMA_COMPLETE_DEBUG", "1");
});

// Bad: module-level mutable state survives the file that mutated it.
let cache = new Map();
```

---

## vi.resetModules is not mock cleanup

**Identifier:** `cs:testing.performance.reset_modules_not_mock_cleanup`

`vi.resetModules()` clears the module REGISTRY — the next import re-evaluates the module — but it does NOT clear the mock registry, and under `isolate: false` a mock can leak into other files that share a transitively imported module. Do not treat `resetModules` as mock cleanup: a test that mocks a module and then calls `resetModules` has disposed of the real module instances but kept the mock, and the next file in the worker that imports a consumer of the mocked module still sees the mock. A file that needs a fresh module instance (`vi.resetModules()` followed by a dynamic import for a clean-state assertion) may still run in the reuse project, provided it mocks nothing — the fresh instance is file-local, the registry is repopulated on demand. Mock cleanup is: `vi.restoreAllMocks()` (spies), `vi.unstubAllEnvs()`/`vi.unstubAllGlobals()` (stubs), and per-file isolation (hoisted mocks).

### Do

Use resetModules for a fresh module instance, and restore mocks separately.
```typescript
afterEach(() => vi.restoreAllMocks());

it("renders the undeclared verb without the suite's checking hooks", async () => {
  // A fresh module instance for the unchecked state; no mocks involved.
  vi.resetModules();
  const fresh = await import("./call.js");
  expect(fresh.renderCall({ verb: "widget list" })).toBeDefined();
});
```

### Don't

Reach for resetModules to clean up a mock, or assume it stops a mock reaching other files.
```typescript
// Bad: resetModules does not touch the mock registry — the hoisted mock of
// ./loadSession.js still answers the next file that imports it transitively.
vi.mock("./loadSession.js", () => ({ loadSession: vi.fn() }));
afterEach(() => vi.resetModules()); // not mock cleanup
```

---

## Verify a performance change against a baseline, not by it passing

**Identifier:** `cs:testing.performance.verification_protocol`

A passing run is not proof of safety for a worker-reuse or environment change. Before and after the change, measure and compare: wall clock, peak memory of the whole run, peak process or worker count, test and coverage numbers. Confirm project membership — every test file lands in exactly one project (`vitest list --filesOnly --project <name>`), with the union across projects equal to all files and no overlap. Confirm order independence — the reuse project alone, shuffled, on at least two different seeds, must produce the same results as unshuffled; a file whose outcome depends on which file ran before it in the shared worker has a leak, not a flake. Confirm per-file environment overrides actually apply (the jsdom docblock wins over a `--environment` CLI flag). A test that fails only under load (external CPU bursts) is re-run on a quiet host and in isolation before being judged; only failures that survive a quiet-host rerun count as real. Acceptance: no test or coverage loss, peak memory and wall clock no worse than baseline, the reuse project stable across seeds.

### Do

Record the same metrics before and after, and prove membership, order independence and overrides.
```typescript
# Baseline and after: wall, peak RSS, worker count, test and coverage numbers.
/usr/bin/time -v vitest run --coverage

# Membership: exactly one project per file; union = all files, overlap = none.
vitest list --filesOnly --project reused | sort > reused.txt
vitest list --filesOnly --project isolated | sort > isolated.txt
comm -12 reused.txt isolated.txt   # must be empty

# Order independence: shuffle the reuse project on two seeds.
vitest run --project reused --sequence.shuffle --sequence.seed=101
vitest run --project reused --sequence.shuffle --sequence.seed=202

# Overrides: the docblock must win over a CLI flag.
vitest run --environment happy-dom src/lib/component/Button/Button.tests.tsx
```

### Don't

Accept a green run as proof, or judge a failure from a single run under external load.
```typescript
# Bad: the run passed, so the split is safe — no membership, shuffle or
# before/after memory comparison was made.

# Bad: four spawn-based tests timed out while the host's load average was
# 46 from an unrelated burst, so the tests are broken — they were never
# re-run on a quiet host or in isolation.
```

---

## Cap test workers explicitly — the full run multiplies them

**Identifier:** `cs:testing.performance.worker_caps`

Every vitest config sets `maxWorkers` explicitly. In a monorepo where the test command fans out across packages (Lerna/Nx run the root `test` target on every affected package), the worst-case worker count is the runner's package concurrency multiplied by the per-package `maxWorkers`, and peak memory and process count matter as much as wall clock — a full run must not push the host into swapping or CPU thrashing. Capping at half the cores (`maxWorkers:

### Do

Set maxWorkers explicitly in every config, consistently across a config's projects.
```typescript
// vitest.config.ts — both projects share the same cap: vitest refuses two
// projects that share a scheduling group but disagree on the worker cap.
const SHARED_TEST_OPTIONS = { maxWorkers: "50%" };
// Worst case on a 16-core host with Lerna default concurrency (16):
// 16 packages × 8 workers = 128, not 16 × 16 = 256.
```

### Don't

Leave maxWorkers unset (the default is every core), or cap the runner instead of the workers.
```typescript
// Bad: unset — every worker slot defaults to the CPU count, and the full
// monorepo run multiplies that by the number of packages testing at once.
export default defineConfig({ test: { globals: true } });

// Bad: compensating in lerna.json — that gate belongs to the package
// configs, and editing the runner is a monorepo-wide change.
```

---

## Split the suite into reused and isolated projects behind a hoisted-mock list

**Identifier:** `cs:testing.performance.worker_reuse`

Vitest's default isolation forks a fresh worker for every test file, so a suite pays one worker spawn per file per run. Suites that do not need per-file isolation split into two projects defined by one shared list of mock-heavy files: a `reused` project (isolate: false) that excludes the list and keeps its worker across files, and an `isolated` project (isolate: true) that includes exactly the list — a hoisted `vi.mock` cannot replace a module another file in the shared worker already evaluated, so those files keep per-file isolation. The single list is the only source for both projects, so a file can never be matched by both or dropped by both, and a guard test fails the run when a file that hoists `vi.mock`/`vi.hoisted` is missing from the list or an entry stops resolving to a real file. Tests that spawn the shipped entry or subprocesses are unaffected by worker reuse and stay in `reused`; a spawn-heavy suite carries a suite-wide `testTimeout` in the config (25 s — above the spawn helper's 20 s kill budget), because vitest's 5 s default under a full parallel run measures CPU contention, not the code. Only timeouts that differ from that default name a number per test (the pack builder's 60 s, the perf harness's 120 s). Under vitest 5, inline projects inherit the root config's test options and concatenate its arrays, so a projects config keeps no test options at the root — shared options are spelled once and spread into both projects, and only coverage (a root-level option whose results merge across projects) sits at the root.

### Do

Define both projects from one exported list, and guard the list with a test.
```typescript
// src/testing/mockHeavyFiles.ts — the single source for BOTH projects.
export const MOCK_HEAVY_FILES = [
  "src/identity.test.ts",
  "src/kernel/runtime/store.test.ts",
] as const;

// vitest.config.ts — the reuse project excludes exactly the list, the
// isolation project includes exactly the list.
import { MOCK_HEAVY_FILES } from "./src/testing/mockHeavyFiles.js";

const SHARED_TEST_OPTIONS = {
  globals: true,
  environment: "node",
  maxWorkers: "50%",
  globalSetup: ["./src/testing/tempRoot.globalSetup.ts"],
  setupFiles: ["./src/testing/setupXdgIsolation.ts"],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "reused",
          ...SHARED_TEST_OPTIONS,
          isolate: false,
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...MOCK_HEAVY_FILES],
        },
      },
      {
        test: {
          name: "isolated",
          ...SHARED_TEST_OPTIONS,
          isolate: true,
          include: [...MOCK_HEAVY_FILES],
          exclude: [...configDefaults.exclude],
        },
      },
    ],
    // Coverage is a ROOT-level option: both projects merge into one gate.
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
```

Guard the list: fail when a hoisting file runs in `reused`, or when an entry stops resolving.
```typescript
// src/testing/mockHeavyGuard.test.ts
const HOISTED_MOCK_PATTERN = /vi\.(mock|hoisted)\s*\(/;

it("every file that hoists vi.mock/vi.hoisted is in MOCK_HEAVY_FILES", () => {
  const offenders = allTestFiles
    .filter((file) => !MOCK_HEAVY_FILES.includes(file))
    .filter((file) =>
      readFileSync(join(ROOT, file), "utf8").match(HOISTED_MOCK_PATTERN),
    );
  expect(offenders).toEqual([]);
});

it("every MOCK_HEAVY_FILES entry resolves to a real test file", () => {
  const missing = MOCK_HEAVY_FILES.filter(
    (file) => !existsSync(join(ROOT, file)),
  );
  expect(missing).toEqual([]);
});
```

### Don't

Repeat the file list in both projects, or put test options at the root of a projects config on vitest 5.
```typescript
// Bad: two hand-maintained lists drift; a file lands in both projects or neither.
const REUSE_EXCLUDE = ["src/identity.test.ts"];
const ISOLATED_INCLUDE = ["src/identity.test.ts", "src/store.test.ts"]; // drift

// Bad on vitest 5: root test options are INHERITED by inline projects and
// root arrays are CONCATENATED — this root include silently reaches every
// project, so the isolated project swallows the whole suite.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"], // leaks into every project
    projects: [{ test: { name: "isolated", isolate: true } }],
  },
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

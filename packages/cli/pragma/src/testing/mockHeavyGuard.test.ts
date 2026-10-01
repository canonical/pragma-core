/**
 * Guard for the two-project worker-reuse split in `vitest.config.ts`.
 *
 * Under `isolate: false` the worker's module registry survives across test
 * files, so a hoisted `vi.mock`/`vi.hoisted` in one file can leak its mock
 * into any other file in the same worker that imports the mocked module
 * transitively. The `isolated` project exists to keep exactly those files
 * away from the shared workers, and this guard keeps the two in lockstep:
 *
 * 1. FAILS when a test file hoists `vi.mock`/`vi.hoisted` calls but is not
 *    listed in `MOCK_HEAVY_FILES` — the file would run in `reused` and could
 *    leak its mock into the worker's registry.
 * 2. FAILS when a `MOCK_HEAVY_FILES` entry stops resolving to a real file —
 *    the `isolated` project would silently run fewer files and the reuse
 *    project would run a file whose only reason for isolation vanished.
 *
 * `vi.doMock` is deliberately NOT matched: it is not hoisted (it takes effect
 * at the next `import`), so it cannot replace a module a file in the same
 * worker already evaluated. A `vi.doMock` file may still need isolation for
 * other reasons, but that is a per-file judgement, not this guard's.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MOCK_HEAVY_FILES } from "./mockHeavyFiles.js";

const ROOT = join(import.meta.dirname, "..", "..");

/** Every `*.test.ts` under `src`, relative to the package root. */
function collectTestFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTestFiles(full));
    } else if (entry.endsWith(".test.ts")) {
      files.push(full.slice(ROOT.length + 1));
    }
  }
  return files;
}

const allTestFiles = collectTestFiles(join(ROOT, "src"));

/**
 * A hoisted mock is a `vi.mock`/`vi.hoisted` call at module top level, i.e.
 * before the first `describe`/`it` runs. Matching the CALL TEXT (rather than
 * the AST) is deliberate: a `vi.mock` call inside a callback is not hoisted,
 * but a file that mocks at all inside callbacks still usually needs
 * isolation — and a mock named in a comment is the one false positive worth
 * having: anyone writing that is describing a mock.
 */
const HOISTED_MOCK_PATTERN = /vi\.(mock|hoisted)\s*\(/;

describe("worker-reuse guard", () => {
  it("every MOCK_HEAVY_FILES entry resolves to a real test file", () => {
    const missing = MOCK_HEAVY_FILES.filter((file) => {
      const existsAsFile =
        existsSync(join(ROOT, file)) && statSync(join(ROOT, file)).isFile();
      return !existsAsFile || !allTestFiles.includes(file);
    });
    expect(missing, "MOCK_HEAVY_FILES entries that no longer exist").toEqual(
      [],
    );
  });

  it("every file that hoists vi.mock/vi.hoisted is in MOCK_HEAVY_FILES", () => {
    const offenders: { file: string; line: number }[] = [];
    for (const file of allTestFiles) {
      if (MOCK_HEAVY_FILES.includes(file)) continue;
      const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
      lines.forEach((text, index) => {
        if (HOISTED_MOCK_PATTERN.test(text)) {
          offenders.push({ file, line: index + 1 });
        }
      });
    }
    expect(
      offenders,
      [
        "files that hoist vi.mock/vi.hoisted but run in the reused project;",
        "add them to MOCK_HEAVY_FILES in src/testing/mockHeavyFiles.ts",
      ].join(" "),
    ).toEqual([]);
  });
});

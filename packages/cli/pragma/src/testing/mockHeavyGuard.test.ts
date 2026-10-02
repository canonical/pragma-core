/**
 * Guard for the worker-reuse split: fails when a file that hoists
 * `vi.mock`/`vi.hoisted` is missing from `MOCK_HEAVY_FILES` (it would leak
 * its mock into the shared worker's registry), or when an entry stops
 * resolving to a real file. `vi.doMock` is deliberately not matched — it is
 * not hoisted, so it cannot replace an already-evaluated module.
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

// CALL TEXT, not AST: a mock named in a comment is the false positive worth
// having — anyone writing that is describing a mock.
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

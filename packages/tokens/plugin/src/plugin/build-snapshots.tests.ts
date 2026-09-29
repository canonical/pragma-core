/**
 * Phase 4 snapshot tests (task 4.2).
 *
 * Snapshots every file in `dist/` to detect regressions on token or plugin
 * changes. Run `bun run test -- -u` to update snapshots after intentional
 * changes.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = resolve(import.meta.dirname, "../../../tokens/dist");

const OUTPUT_FILES = readdirSync(DIST)
  .filter((f) => f.endsWith(".css") || f.endsWith(".json"))
  .sort();

describe("build output snapshots", () => {
  it("dist/ contains the expected set of output files", () => {
    expect(OUTPUT_FILES).toMatchSnapshot();
  });

  for (const file of OUTPUT_FILES) {
    it(`${file} matches snapshot`, () => {
      const content = readFileSync(resolve(DIST, file), "utf8");
      expect(content).toMatchSnapshot();
    });
  }
});

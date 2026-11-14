import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/index.ts", import.meta.url),
);

describe("0001: the router writes docs to the folder it is given", () => {
  it("writes the index into that folder, not ./docs", () => {
    const root = mkdtempSync(join(tmpdir(), "scripts-router-"));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const out = join(root, "docs");
    const run = spawnSync("bun", [script, "docs", out], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(existsSync(join(out, "index.md"))).toBe(true);
  });
});

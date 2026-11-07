import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished } from "vitest";

const script = fileURLToPath(new URL("./index.ts", import.meta.url));

describe("scripts router", () => {
  it("prints its usage for an unknown command", () => {
    const run = spawnSync("bun", [script], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Usage: bun src/scripts/index.ts <command>");
  });

  it("runs the docs generator into the folder it is given", () => {
    const root = mkdtempSync(join(tmpdir(), "scripts-router-"));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const out = join(root, "docs");
    const run = spawnSync("bun", [script, "docs", out], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(existsSync(join(out, "index.md"))).toBe(true);
  });
});

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished, vi } from "vitest";

const script = fileURLToPath(new URL("./index.ts", import.meta.url));

/** Imports the router afresh with `args` after the script name. */
const importWith = async (...args: string[]) => {
  const argv = process.argv;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  onTestFinished(() => {
    process.argv = argv;
    log.mockRestore();
  });
  process.argv = ["bun", script, ...args];
  vi.resetModules();
  await import("./index.js");
  return log;
};

describe("scripts router", () => {
  it.each(["docs", "generate-docs"])(
    "runs the generator for %s",
    async (command) => {
      const root = mkdtempSync(join(tmpdir(), "scripts-router-"));
      onTestFinished(() => rmSync(root, { recursive: true, force: true }));
      await importWith(command, root);
      expect(existsSync(join(root, "index.md"))).toBe(true);
    },
  );

  it("prints its usage when given no command", async () => {
    const log = await importWith();
    expect(log).toHaveBeenCalledWith(
      "Usage: bun src/scripts/index.ts <command>",
    );
  });

  it("prints its usage for an unknown command", () => {
    const run = spawnSync("bun", [script, "nope"], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Usage: bun src/scripts/index.ts <command>");
  });
});

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("./index.ts", import.meta.url));

describe("scripts router", () => {
  it("prints its usage for an unknown command", () => {
    const run = spawnSync("bun", [script, "nope"], { encoding: "utf8" });

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Usage: bun src/scripts/index.ts <command>");
  });
});

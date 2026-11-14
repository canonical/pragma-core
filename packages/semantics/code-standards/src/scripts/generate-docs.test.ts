import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished, vi } from "vitest";

/** Imports the entry afresh with `args` after the script name. */
const importWith = async (...args: string[]) => {
  const argv = process.argv;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  onTestFinished(() => {
    process.argv = argv;
    log.mockRestore();
  });
  process.argv = ["bun", "generate-docs.ts", ...args];
  vi.resetModules();
  await import("./generate-docs.js");
};

describe("generate-docs", () => {
  it("writes the docs of the data folder it is given into the output folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "generate-docs-"));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const data = join(root, "data");
    const out = join(root, "docs");
    mkdirSync(data);
    writeFileSync(
      join(data, "sample.ttl"),
      'cs:sample a cs:Category ;\n    rdfs:label "Sample"@en ;\n    cs:slug "sample" .\n\ncs:sample.rule a cs:CodeStandard ;\n    cs:hasCategory cs:sample .\n',
    );

    await importWith(out, data);

    expect(existsSync(join(out, "sample.md"))).toBe(true);
  });

  it("defaults to ./docs and the package's data folder", async () => {
    const fs = {
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      writeFileSync: vi.fn(),
    };
    vi.doMock("node:fs", () => ({ ...fs, readFileSync: vi.fn() }));
    onTestFinished(() => {
      vi.doUnmock("node:fs");
    });

    await importWith();

    expect(fs.mkdirSync).toHaveBeenCalledWith("./docs", { recursive: true });
    expect(fs.readdirSync).toHaveBeenCalledWith(
      fileURLToPath(new URL("../../data", import.meta.url)),
    );
  });
});

import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished, vi } from "vitest";

const { generateDocsMock } = vi.hoisted(() => ({ generateDocsMock: vi.fn() }));
vi.mock("./generateDocs.js", () => ({ default: generateDocsMock }));

/** Imports the entry afresh with `args` after the script name. */
const importWith = async (...args: string[]) => {
  const argv = process.argv;
  onTestFinished(() => {
    process.argv = argv;
  });
  process.argv = ["bun", "generate-docs.ts", ...args];
  vi.resetModules();
  await import("./generate-docs.js");
};

describe("generate-docs", () => {
  it("passes the folders it is given to generateDocs", async () => {
    await importWith("out", "data");
    expect(generateDocsMock).toHaveBeenLastCalledWith({
      outputDir: "out",
      dataDir: "data",
      log: console.log,
    });
  });

  it("defaults to ./docs and the package's data folder", async () => {
    await importWith();
    expect(generateDocsMock).toHaveBeenLastCalledWith({
      outputDir: "./docs",
      dataDir: fileURLToPath(new URL("../../data", import.meta.url)),
      log: console.log,
    });
  });
});

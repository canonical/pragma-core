import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { run, USAGE } from "./check.js";
import { RULES } from "./value.js";

const DIR = mkdtempSync(join(tmpdir(), "anatomy-dsl-check-"));
const VALID = resolve(
  import.meta.dirname,
  "..",
  "examples",
  "yaml",
  "card.anatomy.yaml",
);

/** Write an anatomy file into the scratch directory and return its path. */
function file(name: string, text: string): string {
  const path = join(DIR, name);
  writeFileSync(path, text);
  return path;
}

/** Run the command line, collecting what it prints. */
async function check(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const exitCode = await run(args, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { exitCode, out, err };
}

const primitiveNotLast = file(
  "primitive-not-last.yaml",
  [
    "node:",
    "  uri: global.component.button",
    "  styles:",
    "    motion.property: [background-color, color]",
    "",
  ].join("\n"),
);

describe("anatomy-dsl check", () => {
  it("passes a valid anatomy with exit code 0", async () => {
    expect(await check("check", VALID)).toEqual({
      exitCode: 0,
      out: [`${VALID}: OK`],
      err: [],
    });
  });

  it("reports a value rule at the line and column of the offending element", async () => {
    expect(await check("check", primitiveNotLast)).toEqual({
      exitCode: 1,
      out: [
        `${primitiveNotLast}:4:23: style value of motion.property "background-color" is rejected: ${RULES.primitiveNotLast}`,
      ],
      err: [],
    });
  });

  it("locates a value under a state-suffixed key", async () => {
    const path = file(
      "slash-path.yaml",
      [
        "node:",
        "  uri: global.component.button",
        "  styles:",
        "    appearance.background@hover: color/background/hover",
        "",
      ].join("\n"),
    );
    const { exitCode, out } = await check("check", path);
    expect(exitCode).toBe(1);
    expect(out).toEqual([
      `${path}:4:34: style value of appearance.background "color/background/hover" is rejected: ${RULES.slashPath}`,
    ]);
  });

  it("reports a document without a top-level node key", async () => {
    const path = file("no-node.yaml", "uri: global.component.button\n");
    const { exitCode, out } = await check("check", path);
    expect(exitCode).toBe(1);
    expect(out).toEqual([
      `${path}: An anatomy document is a mapping with one \`node\` key`,
    ]);
  });

  it("reports a structural error without a location", async () => {
    const path = file(
      "edge-without-target.yaml",
      [
        "node:",
        "  uri: global.component.button",
        "  edges:",
        "    - relation:",
        '        cardinality: "1"',
        "",
      ].join("\n"),
    );
    const { exitCode, out } = await check("check", path);
    expect(exitCode).toBe(1);
    expect(out).toEqual([`${path}: Edge must have node, uri, or switch`]);
  });

  it("reports every file, and fails when any is invalid", async () => {
    const { exitCode, out } = await check("check", VALID, primitiveNotLast);
    expect(exitCode).toBe(1);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(`${VALID}: OK`);
    expect(out[1]).toMatch(`${primitiveNotLast}:4:23: `);
  });

  it("exits 2 on a file it cannot read, and still checks the rest", async () => {
    const missing = join(DIR, "missing.yaml");
    const { exitCode, out, err } = await check(
      "check",
      missing,
      primitiveNotLast,
    );
    expect(exitCode).toBe(2);
    expect(err).toHaveLength(1);
    expect(err[0]).toMatch(`${missing}: cannot be read`);
    expect(out).toHaveLength(1);
  });

  it("exits 2 with the usage when no file or no command is given", async () => {
    for (const args of [["check"], [], ["lint", VALID]]) {
      expect(await check(...args)).toEqual({
        exitCode: 2,
        out: [],
        err: [USAGE],
      });
    }
  });

  it("prints the usage and exits 0 on --help", async () => {
    expect(await check("--help")).toEqual({
      exitCode: 0,
      out: [USAGE],
      err: [],
    });
  });
});

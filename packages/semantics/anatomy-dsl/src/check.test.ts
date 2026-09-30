import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run, type Stdin, USAGE } from "./check.js";
import { RULES } from "./value.js";

const VALID = resolve(
  import.meta.dirname,
  "..",
  "examples",
  "yaml",
  "card.anatomy.yaml",
);

let dir: string;
let primitiveNotLast: string;

/** Write an anatomy file into the scratch directory and return its path. */
function file(name: string, lines: string[]): string {
  const path = join(dir, name);
  writeFileSync(path, `${lines.join("\n")}\n`);
  return path;
}

/** A terminal on stdin: nothing is piped in. */
const TERMINAL = Object.assign(Readable.from([]), { isTTY: true });

/** Run the command line, collecting what it prints. */
async function check(...args: string[]) {
  return checkWith(TERMINAL, ...args);
}

/** Run the command line with `stdin` as its standard input. */
async function checkWith(stdin: Stdin, ...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const exitCode = await run(
    args,
    {
      log: (line: string) => out.push(line),
      error: (line: string) => err.push(line),
    },
    stdin,
  );
  return { exitCode, out, err };
}

/** Standard input carrying `lines`, as a pipe delivers it. */
function piped(lines: string[]): Stdin {
  return Readable.from([`${lines.join("\n")}\n`]);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "anatomy-dsl-check-"));
  primitiveNotLast = file("primitive-not-last.yaml", [
    "node:",
    "  uri: global.component.button",
    "  styles:",
    "    motion.property: [background-color, color]",
  ]);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const PRIMITIVE_NOT_LAST = `style value of motion.property "background-color" is rejected: ${RULES.primitiveNotLast}`;

describe("anatomy-dsl check", () => {
  it("passes valid anatomies with exit code 0", async () => {
    expect(await check("check", VALID, VALID)).toEqual({
      exitCode: 0,
      out: [`${VALID}: OK`, `${VALID}: OK`],
      err: [],
    });
  });

  it("reports a value rule at the line and column of the offending element", async () => {
    expect(await check("check", primitiveNotLast)).toEqual({
      exitCode: 1,
      out: [`${primitiveNotLast}:4:23: ${PRIMITIVE_NOT_LAST}`],
      err: [],
    });
  });

  it("locates a value under a state-suffixed key", async () => {
    const path = file("slash-path.yaml", [
      "node:",
      "  uri: global.component.button",
      "  styles:",
      "    appearance.background@hover: color/background/hover",
    ]);
    expect(await check("check", path)).toEqual({
      exitCode: 1,
      out: [
        `${path}:4:34: style value of appearance.background "color/background/hover" is rejected: ${RULES.slashPath}`,
      ],
      err: [],
    });
  });

  it("locates the style that breaks the rule, not a prop or a valid style of the same name", async () => {
    const path = file("same-key.yaml", [
      "node:",
      "  uri: global.component.button",
      "  props:",
      "    gap: x/y",
      "  styles:",
      "    gap: spacing.gap",
      "  edges:",
      "    - node:",
      "        role: label",
      "        styles:",
      "          gap: x/y",
      "      relation:",
      '        cardinality: "1"',
    ]);
    expect(await check("check", path)).toEqual({
      exitCode: 1,
      out: [
        `${path}:11:16: style value of gap "x/y" is rejected: ${RULES.slashPath}`,
      ],
      err: [],
    });
  });

  it("locates a value in a flow map and behind an alias", async () => {
    const path = file("flow-alias.yaml", [
      "node:",
      "  uri: global.component.button",
      "  props: {spacing: &gap x/y}",
      "  styles: {layout.type: flex, layout.gap: *gap}",
    ]);
    expect(await check("check", path)).toEqual({
      exitCode: 1,
      out: [
        `${path}:4:43: style value of layout.gap "x/y" is rejected: ${RULES.slashPath}`,
      ],
      err: [],
    });
  });

  it("reports a document without a top-level node key", async () => {
    const path = file("no-node.yaml", ["uri: global.component.button"]);
    expect(await check("check", path)).toEqual({
      exitCode: 1,
      out: [`${path}: An anatomy document is a mapping with one \`node\` key`],
      err: [],
    });
  });

  it("reports a structural error without a location", async () => {
    const path = file("edge-without-target.yaml", [
      "node:",
      "  uri: global.component.button",
      "  edges:",
      "    - relation:",
      '        cardinality: "1"',
    ]);
    expect(await check("check", path)).toEqual({
      exitCode: 1,
      out: [`${path}: Edge must have node, uri, or switch`],
      err: [],
    });
  });

  it("reports every file, and fails when any is invalid", async () => {
    expect(await check("check", VALID, primitiveNotLast)).toEqual({
      exitCode: 1,
      out: [`${VALID}: OK`, `${primitiveNotLast}:4:23: ${PRIMITIVE_NOT_LAST}`],
      err: [],
    });
  });

  it("exits 2 on a file it cannot read, and still checks the rest", async () => {
    const missing = join(dir, "missing.yaml");
    const { exitCode, out, err } = await check(
      "check",
      missing,
      primitiveNotLast,
    );
    expect(exitCode).toBe(2);
    expect(err).toHaveLength(1);
    expect(err[0]).toMatch(`${missing}: cannot be read — `);
    expect(out).toEqual([`${primitiveNotLast}:4:23: ${PRIMITIVE_NOT_LAST}`]);
  });

  it("reads piped text when no file is given", async () => {
    const stdin = piped([
      "node:",
      "  uri: global.component.button",
      "  styles:",
      "    motion.property: [background-color, color]",
    ]);
    expect(await checkWith(stdin, "check")).toEqual({
      exitCode: 1,
      out: [`<stdin>:4:23: ${PRIMITIVE_NOT_LAST}`],
      err: [],
    });
  });

  it("reads stdin for a file named -, alongside named files", async () => {
    const stdin = piped(["node:", "  uri: global.component.button"]);
    expect(await checkWith(stdin, "check", VALID, "-")).toEqual({
      exitCode: 0,
      out: [`${VALID}: OK`, "<stdin>: OK"],
      err: [],
    });
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
});

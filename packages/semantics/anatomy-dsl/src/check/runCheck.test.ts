import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DUPLICATE_KEY,
  MINIMAL,
  NO_NODE,
  PRIMITIVE_NOT_LAST,
  PRIMITIVE_NOT_LAST_MESSAGE,
  VALID_FILE,
} from "../../testing/fixtures.js";
import { USAGE } from "./constants.js";
import runCheck from "./runCheck.js";
import type { Stdin } from "./types.js";

/** A terminal on stdin: nothing is piped in. */
const TERMINAL: Stdin = Object.assign(Readable.from([]), { isTTY: true });

let dir: string;
let invalidFile: string;

/** Run the command line with `stdin` as its input, collecting what it prints. */
async function runWith(stdin: Stdin, ...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const exitCode = await runCheck(
    args,
    {
      log: (line: string) => out.push(line),
      error: (line: string) => err.push(line),
    },
    stdin,
  );
  return { exitCode, out, err };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "anatomy-dsl-check-"));
  invalidFile = join(dir, "primitive-not-last.yaml");
  writeFileSync(invalidFile, PRIMITIVE_NOT_LAST);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runCheck", () => {
  it("passes valid files with exit code 0", async () => {
    expect(await runWith(TERMINAL, "check", VALID_FILE, VALID_FILE)).toEqual({
      exitCode: 0,
      out: [`${VALID_FILE}: OK`, `${VALID_FILE}: OK`],
      err: [],
    });
  });

  it("prints a problem with its file, line and column, and exits 1", async () => {
    expect(await runWith(TERMINAL, "check", VALID_FILE, invalidFile)).toEqual({
      exitCode: 1,
      out: [
        `${VALID_FILE}: OK`,
        `${invalidFile}:4:23: ${PRIMITIVE_NOT_LAST_MESSAGE}`,
      ],
      err: [],
    });
  });

  it("exits 2 on a file it cannot read, and still checks the rest", async () => {
    const missing = join(dir, "missing.yaml");
    const { exitCode, out, err } = await runWith(
      TERMINAL,
      "check",
      missing,
      invalidFile,
    );
    expect(exitCode).toBe(2);
    expect(err).toHaveLength(1);
    expect(err.at(0)).toMatch(`${missing}: cannot be read — `);
    expect(out).toEqual([`${invalidFile}:4:23: ${PRIMITIVE_NOT_LAST_MESSAGE}`]);
  });

  it("reads piped text when no file is given", async () => {
    expect(await runWith(Readable.from([PRIMITIVE_NOT_LAST]), "check")).toEqual(
      {
        exitCode: 1,
        out: [`<stdin>:4:23: ${PRIMITIVE_NOT_LAST_MESSAGE}`],
        err: [],
      },
    );
  });

  it("reads stdin for a file named -, alongside named files", async () => {
    expect(
      await runWith(Readable.from([MINIMAL]), "check", VALID_FILE, "-"),
    ).toEqual({
      exitCode: 0,
      out: [`${VALID_FILE}: OK`, "<stdin>: OK"],
      err: [],
    });
  });

  it("prints a YAML syntax error with its line and column, and exits 1", async () => {
    expect(await runWith(Readable.from([DUPLICATE_KEY]), "check")).toEqual({
      exitCode: 1,
      out: ["<stdin>:3:3: Map keys must be unique"],
      err: [],
    });
  });

  it("prints a problem without a location as file and message", async () => {
    expect(await runWith(Readable.from([NO_NODE]), "check")).toEqual({
      exitCode: 1,
      out: ["<stdin>: An anatomy document is a mapping with one `node` key"],
      err: [],
    });
  });

  it("exits 2 with the usage when no file or no command is given", async () => {
    for (const args of [["check"], [], ["lint", VALID_FILE]]) {
      expect(await runWith(TERMINAL, ...args)).toEqual({
        exitCode: 2,
        out: [],
        err: [USAGE],
      });
    }
  });
});

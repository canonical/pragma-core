import { readFile } from "node:fs/promises";
import {
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Scalar,
  visit,
} from "yaml";
import { parseAnatomyYAML } from "./parse.js";
import { AnatomyValueError, parseStyleValue } from "./value.js";

export const USAGE = "Usage: anatomy-dsl check <file...>";

/** Where a report line goes: `out` for results, `err` for usage and read errors. */
export interface Output {
  out: (line: string) => void;
  err: (line: string) => void;
}

/**
 * Run the command line: `check <file...>`. Each file is parsed with
 * `parseAnatomyYAML`, the parser every consumer of an anatomy uses, so a file
 * passes here exactly when it parses there. The result is the exit code: 0
 * when every file parses, 1 when any does not, 2 on a usage error or a file
 * that cannot be read.
 */
export async function run(args: string[], output: Output): Promise<number> {
  const [command, ...files] = args;
  if (command === "-h" || command === "--help") {
    output.out(USAGE);
    return 0;
  }
  if (command !== "check" || files.length === 0) {
    output.err(USAGE);
    return 2;
  }
  let exitCode = 0;
  for (const file of files) {
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      output.err(`${file}: cannot be read — ${(error as Error).message}`);
      exitCode = 2;
      continue;
    }
    const problem = checkText(text);
    if (problem === undefined) {
      output.out(`${file}: OK`);
      continue;
    }
    const at =
      problem.line === undefined ? "" : `:${problem.line}:${problem.column}`;
    output.out(`${file}${at}: ${problem.message}`);
    exitCode = Math.max(exitCode, 1);
  }
  return exitCode;
}

/** Why a document does not parse, and where, when the YAML can say. */
interface Problem {
  message: string;
  line?: number;
  column?: number;
}

/** The first problem `parseAnatomyYAML` finds in the text, or undefined. */
function checkText(text: string): Problem | undefined {
  try {
    parseAnatomyYAML(text);
    return undefined;
  } catch (error) {
    const message = (error as Error).message;
    return error instanceof AnatomyValueError
      ? { message, ...locate(text, error) }
      : { message };
  }
}

/**
 * The line and column of the style value an `AnatomyValueError` names: the
 * first style entry whose key and value raise that same error, and within a
 * sequence the element the error quotes.
 */
function locate(
  text: string,
  error: AnatomyValueError,
): { line: number; column: number } | undefined {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
  let offset: number | undefined;
  visit(document, {
    Pair(_, pair) {
      const authored = pair.key;
      if (!isScalar(authored)) return;
      const key = String(authored.value).split("@")[0];
      if (key !== error.key) return;
      const value = isNode(pair.value) ? pair.value : undefined;
      try {
        parseStyleValue(value?.toJSON() ?? null, key);
        return;
      } catch (candidate) {
        if ((candidate as Error).message !== error.message) return;
      }
      const element = isSeq(value)
        ? value.items.find(
            (item): item is Scalar =>
              isScalar(item) && String(item.value) === error.value,
          )
        : undefined;
      offset = (element ?? value ?? authored).range?.[0];
      return visit.BREAK;
    },
  });
  if (offset === undefined) return undefined;
  const { line, col } = lineCounter.linePos(offset);
  return { line, column: col };
}

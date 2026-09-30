import { readFile } from "node:fs/promises";
import {
  type Document,
  isNode,
  isPair,
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

/**
 * Run the command line: `check <file...>`. Each file is parsed with
 * `parseAnatomyYAML`, the parser every consumer of an anatomy uses, so a file
 * passes here exactly when it parses there. Results go to `log`, usage and
 * read errors to `error`. The result is the exit code: 0 when every file
 * parses, 1 when any does not, 2 on a usage error or a file that cannot be
 * read.
 */
export async function run(
  args: string[],
  output: Pick<Console, "log" | "error">,
): Promise<number> {
  const [command, ...files] = args;
  if (command !== "check" || files.length === 0) {
    output.error(USAGE);
    return 2;
  }
  let exitCode = 0;
  for (const file of files) {
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      output.error(`${file}: cannot be read — ${(error as Error).message}`);
      exitCode = 2;
      continue;
    }
    const problem = checkText(text);
    if (problem === undefined) {
      output.log(`${file}: OK`);
      continue;
    }
    const at =
      problem.line === undefined ? "" : `:${problem.line}:${problem.col}`;
    output.log(`${file}${at}: ${problem.message}`);
    exitCode = Math.max(exitCode, 1);
  }
  return exitCode;
}

/** Why a document does not parse, and where, when the YAML can say. */
interface Problem {
  message: string;
  line?: number;
  col?: number;
}

/** The first problem `parseAnatomyYAML` finds in the text, or undefined. */
function checkText(text: string): Problem | undefined {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
  try {
    parseAnatomyYAML(document.toJS());
    return undefined;
  } catch (error) {
    const message = (error as Error).message;
    if (!(error instanceof AnatomyValueError)) return { message };
    const offset = locate(document, error);
    return offset === undefined
      ? { message }
      : { message, ...lineCounter.linePos(offset) };
  }
}

/**
 * The offset of the style value an `AnatomyValueError` names: the first
 * `styles` entry whose key and value raise that same error, and within a
 * sequence the element the error quotes.
 */
function locate(
  document: Document,
  error: AnatomyValueError,
): number | undefined {
  let offset: number | undefined;
  visit(document, {
    Pair(_, pair, path) {
      const styles = path.at(-2);
      if (!isPair(styles) || !isScalar(styles.key)) return;
      if (styles.key.value !== "styles") return;
      const authored = pair.key;
      if (!isScalar(authored)) return;
      const key = String(authored.value).split("@")[0];
      if (key !== error.key) return;
      const value = isNode(pair.value) ? pair.value : undefined;
      try {
        parseStyleValue(value?.toJS(document) ?? null, key);
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
  return offset;
}

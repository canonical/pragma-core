import checkText from "./checkText.js";
import { STDIN_ARGUMENT, STDIN_LABEL, USAGE } from "./constants.js";
import readInput from "./readInput.js";
import type { Output, Stdin } from "./types.js";

/**
 * Run the command line `check <file...>` and return its exit code: 0 when
 * every file parses, 1 when any does not, 2 on a usage error or a file that
 * cannot be read (the other files are still checked). A file named `-` is
 * read from `stdin`, and so is a `check` given no file while its input is
 * piped. Each file gets one line on `output.log`: `OK`, or the problem with
 * its line and column when the YAML can say.
 *
 * @note Impure: reads files and standard input, and prints to `output`.
 */
export default async function runCheck(
  args: string[],
  output: Output,
  stdin: Stdin = process.stdin,
): Promise<number> {
  const [command, ...named] = args;
  const files = named.length === 0 && !stdin.isTTY ? [STDIN_ARGUMENT] : named;
  if (command !== "check" || files.length === 0) {
    output.error(USAGE);
    return 2;
  }
  let exitCode = 0;
  for (const name of files) {
    const label = name === STDIN_ARGUMENT ? STDIN_LABEL : name;
    let text: string;
    try {
      text = await readInput(name, stdin);
    } catch (error) {
      output.error(`${label}: cannot be read — ${(error as Error).message}`);
      exitCode = 2;
      continue;
    }
    const problem = checkText(text);
    if (problem === undefined) {
      output.log(`${label}: OK`);
      continue;
    }
    const at =
      problem.line === undefined ? "" : `:${problem.line}:${problem.col}`;
    output.log(`${label}${at}: ${problem.message}`);
    exitCode = Math.max(exitCode, 1);
  }
  return exitCode;
}

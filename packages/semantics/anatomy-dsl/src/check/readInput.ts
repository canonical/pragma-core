import { readFile } from "node:fs/promises";
import { text } from "node:stream/consumers";
import { STDIN_ARGUMENT } from "./constants.js";
import type { Stdin } from "./types.js";

/**
 * Read the text a file argument names: standard input for `-`, otherwise the
 * file at that path.
 *
 * @note Impure: reads the file system or standard input.
 */
export default function readInput(name: string, stdin: Stdin): Promise<string> {
  return name === STDIN_ARGUMENT ? text(stdin) : readFile(name, "utf8");
}

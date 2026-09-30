/** Where standard input is read from: the process's own, or a stand-in. */
export type Stdin = NodeJS.ReadableStream & { isTTY?: boolean };

/** Where the command prints: results to `log`, usage and read errors to `error`. */
export type Output = Pick<Console, "log" | "error">;

/** Why a document does not parse, and where, when the YAML can say. */
export interface Problem {
  message: string;
  line?: number;
  col?: number;
}

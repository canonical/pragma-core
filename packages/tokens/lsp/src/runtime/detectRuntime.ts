/**
 * @note impure — spawns child processes to probe runtime availability.
 */
import { execFile } from "node:child_process";

// Match Node major versions >= 22, including three-digit majors (v100+).
const NODE_RUNTIME_PATTERN = /^v(?:2[2-9]|[3-9]\d|\d{3,})(?:\.|$)/;

type ProbeRuntime = (
  command: string,
  args: string[],
  versionPattern?: RegExp,
) => Promise<boolean>;

/**
 * Detect the runtime used to launch the language server.
 *
 * Prefers `bun`, falls back to `node` when version >= 22, and
 * respects an explicit user override.
 */
export default async function detectRuntime(
  override: string,
  probeRuntime: ProbeRuntime = runProbeRuntime,
): Promise<string | null> {
  if (override) {
    return override;
  }

  if (await probeRuntime("bun", ["--version"])) {
    return "bun";
  }

  if (await probeRuntime("node", ["--version"], NODE_RUNTIME_PATTERN)) {
    return "node";
  }

  return null;
}

async function runProbeRuntime(
  command: string,
  args: string[],
  versionPattern?: RegExp,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    execFile(command, args, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }

      const output = stdout.trim();
      if (versionPattern && !versionPattern.test(output)) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

import { BIN_NAME } from "../../../constants.js";
import type { PragmaRuntime } from "../../../kernel/runtime/index.js";
import { detectInstallSource } from "../../shared/index.js";
import { detectUnreleased } from "../../shared/releaseState.js";
import type { CheckResult } from "../types.js";

/**
 * Report the CLI version and how it was installed, and name every part of the
 * CLI or its store that is past its release. Always passes — purely
 * informational.
 *
 * @param rt - The per-invocation runtime (for `version` and `cwd`).
 * @returns A CheckResult with version and install details, and one item per
 *   unreleased part.
 * @note Impure — reads the process for the install heuristic, the config
 *   layers, and git.
 */
export async function checkPragmaVersion(
  rt: PragmaRuntime,
): Promise<CheckResult> {
  const install = detectInstallSource();
  const unreleased = detectUnreleased(await rt.loadConfig(), rt.cwd);
  return {
    name: `${BIN_NAME} version`,
    status: "pass",
    detail: `v${rt.version}${unreleased.length > 0 ? " + unreleased changes" : ""} (installed via ${install.label})`,
    ...(unreleased.length > 0
      ? {
          items: unreleased.map((part) => ({
            label: part.name,
            detail: part.detail,
          })),
        }
      : {}),
  };
}

/**
 * Reconcile the framework answer with the rest of the answer set.
 *
 * `--framework` is a select over three values, and two of the nine
 * combinations it can form with the other flags describe a package that
 * cannot exist:
 *
 * - **A framework on a non-`library` type.** `tool-ts` runs from `src/` with
 *   no build and `css` has no TypeScript at all, so neither has anywhere to
 *   put a component or a JSX/Svelte compile step. The framework is dropped.
 * - **`svelte` together with `--with-cli`.** A Svelte library is built by
 *   `svelte-package`, which emits a component tree — not an executable entry
 *   point — so a `bin` would name a file the build never writes. The CLI is
 *   dropped, not the framework: the framework is the answer that shaped the
 *   whole package, the CLI entry point is the incidental extra.
 *
 * Both are **coerced with a warning, never thrown**. The generator is often
 * driven non-interactively (`pragma create package …`, MCP), where an abort
 * costs a whole round-trip to fix one flag, and in both cases exactly one
 * consistent package is meant. The warning is what makes the coercion
 * visible.
 *
 * The deprecated `--with-react` is folded onto `framework` here too, so the
 * answer set a result reports and the files a run writes always agree.
 *
 * Pure: it decides, the caller emits the warnings and writes the files.
 */

import type { Framework, PackageAnswers, PackageType } from "./types.js";

/** The answers `resolveFramework` reads, and nothing else. */
export interface FrameworkInput {
  readonly type: PackageType;
  readonly framework: Framework;
  readonly withCli: boolean;
}
/** The reconciled answers, plus the human-readable reason for each change. */
export interface FrameworkResolution {
  /** The framework to generate for. */
  readonly framework: Framework;
  /** Whether to emit a CLI entry point. */
  readonly withCli: boolean;
  /** One message per coercion applied; empty when the answers were coherent. */
  readonly warnings: readonly string[];
}

/**
 * Reconcile `framework` and `withCli` against the package type.
 *
 * @param answers - The framework-relevant answers.
 * @returns The coerced values and the warnings explaining them.
 */
export default function resolveFramework(
  answers: FrameworkInput,
): FrameworkResolution {
  const warnings: string[] = [];
  let framework = answers.framework;
  let withCli = answers.withCli;

  if (framework !== "none" && answers.type !== "library") {
    warnings.push(
      `--framework=${framework} applies to library packages only; ` +
        `generating a plain ${answers.type} package instead.`,
    );
    framework = "none";
  }

  if (framework === "svelte" && withCli) {
    warnings.push(
      "--with-cli is not supported for Svelte libraries (svelte-package " +
        "emits a component tree, not an executable); omitting the CLI entry " +
        "point.",
    );
    withCli = false;
  }

  return { framework, withCli, warnings };
}

/**
 * {@link resolveFramework} over a full answer set, returning answers that are
 * safe to hand to the templates.
 *
 * The deprecated `--with-react` flag is folded into `framework` here, so every
 * caller — the wizard, `pragma create`, MCP — sees one framework answer and
 * the templates never read the legacy field.
 *
 * @param answers - The generator's answers.
 * @returns The reconciled answers and the warnings explaining any change.
 */
export function resolveAnswers(answers: PackageAnswers): {
  readonly answers: PackageAnswers;
  readonly warnings: readonly string[];
} {
  const warnings: string[] = [];
  let framework = answers.framework;

  if (answers.withReact === true) {
    warnings.push("--with-react is deprecated; use --framework=react instead.");
    if (framework === "none") framework = "react";
    else if (framework !== "react")
      warnings.push(
        `Ignoring --with-react because --framework=${framework} was given.`,
      );
  }

  const reconciled = resolveFramework({ ...answers, framework });
  return {
    answers: {
      ...answers,
      framework: reconciled.framework,
      withCli: reconciled.withCli,
    },
    warnings: [...warnings, ...reconciled.warnings],
  };
}

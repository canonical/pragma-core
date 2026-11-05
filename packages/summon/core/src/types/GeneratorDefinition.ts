import type { Task } from "@canonical/task";
import type GeneratorMeta from "./GeneratorMeta.js";
import type PromptDefinition from "./PromptDefinition.js";

/**
 * The complete definition of a generator.
 *
 * @typeParam TAnswers - Type of the answers object passed to generate
 */
export default interface GeneratorDefinition<
  TAnswers = Record<string, unknown>,
> {
  /** Generator metadata for CLI display */
  meta: GeneratorMeta;
  /** Prompts to collect answers from user */
  prompts: PromptDefinition[];
  /**
   * Optional pure reconciliation of the answer set before validation and
   * generation.
   *
   * A generator that coerces answers (a deprecated flag folded into its
   * replacement, an impossible combination made coherent) declares the rule
   * here instead of only inside `generate`. `execute` then validates and
   * generates from the reconciled answers AND returns them in
   * `GeneratorResult.answers`, so the structured outcome a machine reads
   * agrees with the files the run wrote. The rule must be idempotent:
   * `generate` applies it again for callers that drive a build directly.
   */
  reconcileAnswers?: (answers: TAnswers) => TAnswers;
  /**
   * Pure function that returns a Task describing the generation.
   *
   * The returned task must be RE-INTERPRETABLE: compose it from combinators
   * (`sequence_`, `when`, `flatMap`, …), never from a single-use `gen()` —
   * a gen() task closes over one iterator, and the runners interpret a build
   * more than once (dry-run preview, undo collection with backtracking).
   * `execute()` shields callers by invoking `generate` freshly per
   * interpretation, but direct drivers of one build get truncated re-drives.
   */
  generate: (answers: TAnswers) => Task<void>;
}

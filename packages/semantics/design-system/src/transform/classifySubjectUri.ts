import isValidReferenceUri from "./isValidReferenceUri.js";

/**
 * Verdict on a row's subject URI, as built from its `uriTemplate`.
 *
 * The three cases are genuinely different and were previously conflated into
 * a single `null` return from transformRow:
 *
 * - `empty` — the row has no `uri` at all. Routine: Coda grids carry trailing
 *   blank rows, and skipping them is correct and unremarkable.
 * - `malformed` — the row HAS a uri, but a degenerate one (empty local name,
 *   or empty dot-separated segments such as `ds:global..`, from a blank or
 *   dangling upstream reference). Emitting it would produce invalid Turtle,
 *   so the row is dropped — which silently removes a subject that the source
 *   document believes exists. That is a defect at the source, not routine.
 * - `valid` — safe to emit.
 */
export type SubjectUriVerdict = "empty" | "malformed" | "valid";

/**
 * Classify a row's raw subject URI.
 *
 * Single source of truth for the empty-versus-malformed boundary: transformRow
 * uses it to decide whether to warn, and the fail-closed malformed-row guard
 * (see deltaGuards.ts) counts exactly the `malformed` verdicts. Keeping one
 * predicate means the guard can never disagree with the transform about which
 * rows were dropped and why.
 *
 * @param rawSubjectUri - Output of `buildUri(config.uriTemplate, row)`.
 */
export default function classifySubjectUri(
  rawSubjectUri: string,
): SubjectUriVerdict {
  if (rawSubjectUri === "") {
    return "empty";
  }
  return isValidReferenceUri(rawSubjectUri) ? "valid" : "malformed";
}

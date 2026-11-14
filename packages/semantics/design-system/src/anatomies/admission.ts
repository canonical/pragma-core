/**
 * The register's admission of the two derivation findings (a cell that does not parse,
 * a dangling `uri:`), shared by every home of the law: `validate` sets its exit code
 * by it, the transform guard refuses by it, and the write refuses by it. One function,
 * so the three cannot disagree about which failure a row admits.
 */
import {
  type BindingFinding,
  type RegisterRow,
  UNKNOWN_KEY_CODE,
  UNPARSEABLE_CODE,
} from "../transform/tokenBindings.js";

/**
 * Why a cell does not parse, as a short closed vocabulary (X16's `value`).
 *
 * The parse error's own prose is not the row's value: it moves with the `yaml` package
 * and with `anatomy-dsl`'s wording, and a register whose rows churn on a dependency
 * bump is a register nobody reads. These seven reasons are stable, they are what a
 * repair has to address, and each is a different repair:
 *
 *   not-an-anatomy       the cell is not a mapping (a markdown fence, a prose line
 *                        without a colon, a whole Turtle document), or it is a
 *                        mapping whose only fault is a missing `node`.
 *   unknown-key          the parser rejected a key the mapping does not take (AT23):
 *                        misspelt, or misplaced, such as `edges` beside an edge's
 *                        `node`. A mapping with only foreign keys lands here, a
 *                        bare `uri:` without its `node:` or a prose line with a
 *                        colon, because its first unknown key is named first.
 *   malformed-key        the parser rejected a key the mapping does take (AT23):
 *                        missing, of the wrong shape, or not going with another,
 *                        such as an edge without its `relation`.
 *   retired-slash-path   a value in the retired slash notation — the ordinary case
 *                        today, and what authoring the anatomy by hand replaces.
 *   retired-marker       the retired trailing `?`.
 *   primitive-not-last   a sequence with a literal anywhere but at the end.
 *   yaml-error           the cell is not well-formed YAML.
 *
 * The three AT23 reasons are decided from the error where the derivation catches it,
 * and carried on the finding as `reason`; `classifyAdmission` prefers that field. This
 * function reads the message, for every other parse failure.
 */
export function classifyParseFailure(message: string): string {
  if (message.includes("mapping with one `node` key")) {
    return "not-an-anatomy";
  }
  if (message.includes("slash-delimited token path")) {
    return "retired-slash-path";
  }
  if (message.includes("trailing `?` marker")) {
    return "retired-marker";
  }
  if (message.includes("a primitive may only end a value")) {
    return "primitive-not-last";
  }
  return "yaml-error";
}

/** The `uri:` a dangling-reference finding names. */
export function danglingReference(message: string): string {
  return message.replace(/^.*uri: /, "").split(" ")[0];
}

/**
 * The register row a derivation finding is admitted by: its category and its value.
 * A parse failure is filed under X16 whatever its code, so a key the parser rejects
 * (AT23) is admitted, written and counted as every other cell that does not parse.
 */
export function classifyAdmission(finding: BindingFinding): {
  category: string;
  value: string;
} {
  if (finding.code === "X11") {
    return { category: "X11", value: danglingReference(finding.message) };
  }
  return {
    category:
      finding.code === UNKNOWN_KEY_CODE ? UNPARSEABLE_CODE : finding.code,
    value: finding.reason ?? classifyParseFailure(finding.message),
  };
}

/**
 * The two derivation findings the register can admit (§5.3).
 *
 * A dangling `uri:` with an X11 row passes; a cell that does not parse with an X16 row
 * passes. The derivation reports both unconditionally, because it has no register to
 * consult — the admission happens here, where the rows are, and it is keyed on the
 * block as well as the reason so a row cannot admit a different block's failure.
 */
export function admitRegistered(
  findings: readonly BindingFinding[],
  rows: readonly RegisterRow[],
): BindingFinding[] {
  const admitted = new Set(
    rows
      .filter((row) => row.category === "X11" || row.category === "X16")
      .map((row) => `${row.category} ${row.uri} ${row.value}`),
  );
  // The key carries the category the finding is filed under, so a code the derivation
  // might grow later is admitted by nothing and stays a finding — no roster to keep in
  // step.
  return findings.filter((finding) => {
    const uri = (finding.block as string).split("/").pop();
    const { category, value } = classifyAdmission(finding);
    return !admitted.has(`${category} ${uri} ${value}`);
  });
}

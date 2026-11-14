import assertDefined from "./assertDefined.js";
import { PREFIXED_NAME } from "./constants.js";
import findOutside from "./findOutside.js";
import type { Subject } from "./types.js";

const SUBJECT = new RegExp(
  String.raw`^${PREFIXED_NAME}\s+a\s+${PREFIXED_NAME}`,
  "m",
);

/**
 * Returns each `<iri> a <class>` subject line outside literals, comments and
 * IRIs. Throws naming the last subject before text it cannot read.
 */
export default function findSubjects(content: string): Subject[] {
  const subjects: Subject[] = [];
  let found = findOutside(content, SUBJECT);
  while (found !== null) {
    const [id, , type] = found.text.split(/\s+/);
    subjects.push({
      ...found,
      id: assertDefined(id, "subject IRI"),
      type: assertDefined(type, "subject class"),
    });
    try {
      found = findOutside(content, SUBJECT, found.end);
    } catch (error) {
      throw new Error(
        `${assertDefined(id, "subject IRI")}: ${(error as Error).message}`,
      );
    }
  }
  return subjects;
}

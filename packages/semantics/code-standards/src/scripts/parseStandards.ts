import { PREFIXED_NAME } from "./constants.js";
import findBlankNodes from "./findBlankNodes.js";
import findOutside from "./findOutside.js";
import findSubjects from "./findSubjects.js";
import parseExamples from "./parseExamples.js";
import readLiteral from "./readLiteral.js";
import type { Standard } from "./types.js";

const CATEGORY_REF = new RegExp(String.raw`cs:hasCategory\s+${PREFIXED_NAME}`);
const DESCRIPTION = /(?<![\w:.-])cs:description\s/;

/** Blanks out a block's examples, so only the standard's own triples remain. */
const removeExamples = (block: string): string =>
  [
    ...findBlankNodes(block, "cs:do"),
    ...findBlankNodes(block, "cs:dont"),
  ].reduce(
    (own, node) =>
      own.slice(0, node.index) +
      " ".repeat(node.text.length) +
      own.slice(node.end),
    block,
  );

/** Reads one standard's block, or nothing when it names no category. */
const readStandard = (id: string, block: string): Standard[] => {
  const own = removeExamples(block);
  const categoryRef = findOutside(own, CATEGORY_REF)?.text.split(/\s+/).at(1);
  if (categoryRef === undefined) {
    return [];
  }

  const first = findOutside(own, DESCRIPTION);
  if (first !== null && findOutside(own, DESCRIPTION, first.end) !== null) {
    throw new Error("More than one cs:description");
  }

  return [
    {
      id,
      name: readLiteral(own, "rdfs:label"),
      description: readLiteral(own, "cs:description"),
      categoryRef,
      dos: parseExamples(block, "cs:do"),
      donts: parseExamples(block, "cs:dont"),
    },
  ];
};

/**
 * Returns the standards a Turtle file declares, sorted by IRI. Throws naming
 * the standard whose block it cannot read.
 */
export default function parseStandards(content: string): Standard[] {
  const subjects = findSubjects(content);
  return subjects
    .flatMap((subject, position) => {
      if (subject.type !== "cs:CodeStandard") {
        return [];
      }
      const end = subjects.at(position + 1)?.index ?? content.length;
      try {
        return readStandard(subject.id, content.slice(subject.index, end));
      } catch (error) {
        throw new Error(`${subject.id}: ${(error as Error).message}`);
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

import assertDefined from "./assertDefined.js";
import findBlankNodes from "./findBlankNodes.js";
import findOutside from "./findOutside.js";
import parseExamples from "./parseExamples.js";
import readLiteral from "./readLiteral.js";
import type { Found, Standard } from "./types.js";

const SUBJECT = /^[A-Za-z][\w-]*:[A-Za-z0-9_.-]+\s+a\s+cs:CodeStandard\b/m;
const CATEGORY_REF = /cs:hasCategory\s+(cs:[A-Za-z0-9_.]+)/;
const DESCRIPTION = /(?<![\w:.-])cs:description\s/;

/** Returns the IRI a standard's subject line names. */
const idOf = (subject: Found): string =>
  assertDefined(subject.text.split(/\s/).at(0), "standard id");

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
  const categoryRef = block.match(CATEGORY_REF)?.at(1);
  if (categoryRef === undefined) {
    return [];
  }

  const own = removeExamples(block);
  const first = findOutside(own, DESCRIPTION);
  if (first !== null && findOutside(own, DESCRIPTION, first.end) !== null) {
    throw new Error("more than one cs:description");
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
  const subjects: Found[] = [];
  let found = findOutside(content, SUBJECT);
  while (found !== null) {
    subjects.push(found);
    const current = found;
    try {
      found = findOutside(content, SUBJECT, current.end);
    } catch (error) {
      throw new Error(`${idOf(current)}: ${(error as Error).message}`);
    }
  }

  return subjects
    .flatMap((subject, position) => {
      const id = idOf(subject);
      const end = subjects.at(position + 1)?.index ?? content.length;
      try {
        return readStandard(id, content.slice(subject.index, end));
      } catch (error) {
        throw new Error(`${id}: ${(error as Error).message}`);
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

import { PREFIXED_NAME } from "./constants.js";
import findOutside from "./findOutside.js";
import findSubjects from "./findSubjects.js";
import readLiteral from "./readLiteral.js";
import type { CategoryInfo } from "./types.js";

const BROADER = new RegExp(String.raw`skos:broader\s+${PREFIXED_NAME}`);

/**
 * Returns the categories a Turtle file declares, each read up to the next
 * subject. Throws naming the category it cannot read.
 */
export default function parseCategories(content: string): CategoryInfo[] {
  const subjects = findSubjects(content);
  return subjects.flatMap((subject, position) => {
    if (subject.type !== "cs:Category") {
      return [];
    }
    const end = subjects.at(position + 1)?.index ?? content.length;
    const block = content.slice(subject.index, end);
    try {
      return [
        {
          id: subject.id,
          label: readLiteral(block, "rdfs:label"),
          slug: readLiteral(block, "cs:slug"),
          broader: findOutside(block, BROADER)?.text.split(/\s+/).at(1) ?? null,
          scopeNote: readLiteral(block, "skos:scopeNote"),
        },
      ];
    } catch (error) {
      throw new Error(`${subject.id}: ${(error as Error).message}`);
    }
  });
}

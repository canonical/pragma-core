import assertDefined from "./assertDefined.js";
import readLiteral from "./readLiteral.js";
import type { CategoryInfo } from "./types.js";

const CATEGORY = /^(cs:[A-Za-z0-9_.]+)\s+a\s+cs:Category\b/gm;
const BROADER = /skos:broader\s+(cs:[A-Za-z0-9_.]+)/;

/** Returns the categories a Turtle file declares, each read up to its block's blank line. */
export default function parseCategories(content: string): CategoryInfo[] {
  return [...content.matchAll(CATEGORY)].map((match) => {
    const end = content.indexOf("\n\n", match.index);
    const block = content.slice(match.index, end === -1 ? content.length : end);
    return {
      id: assertDefined(match.at(1), "category id"),
      label: readLiteral(block, "rdfs:label"),
      slug: readLiteral(block, "cs:slug"),
      broader: block.match(BROADER)?.at(1) ?? null,
      scopeNote: readLiteral(block, "skos:scopeNote"),
    };
  });
}

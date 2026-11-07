import { describe, expect, it } from "vitest";
import parseCategories from "./parseCategories.js";

describe("parseCategories", () => {
  it("reads each category's label, slug, parent and scope note", () => {
    const turtle = `cs:root a cs:Category ;
    rdfs:label "Root"@en ;
    cs:slug "root" .

cs:root.sub a cs:Category ;
    rdfs:label "Sub"@en ;
    skos:broader cs:root ;
    skos:scopeNote "Only the sub."@en .`;

    expect(parseCategories(turtle)).toEqual([
      {
        id: "cs:root",
        label: "Root",
        slug: "root",
        broader: null,
        scopeNote: "",
      },
      {
        id: "cs:root.sub",
        label: "Sub",
        slug: "",
        broader: "cs:root",
        scopeNote: "Only the sub.",
      },
    ]);
  });

  it("returns no category for a file that declares none", () => {
    expect(parseCategories("cs:x a cs:CodeStandard .")).toEqual([]);
  });
});

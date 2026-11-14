import { describe, expect, it } from "vitest";
import findSubjects from "./findSubjects.js";

describe("findSubjects", () => {
  it("returns each subject's IRI and class, skipping ones inside literals", () => {
    const turtle = `cs:a a cs:Category .
cs:b a cs:CodeStandard ;
    cs:code """
cs:fake a cs:Category .
""" .`;

    expect(findSubjects(turtle).map(({ id, type }) => [id, type])).toEqual([
      ["cs:a", "cs:Category"],
      ["cs:b", "cs:CodeStandard"],
    ]);
  });

  it("leaves a statement's closing dot out of the class", () => {
    expect(findSubjects("cs:a a cs:Category.").at(0)?.type).toBe("cs:Category");
  });

  it("names the last subject before text it cannot read", () => {
    expect(() =>
      findSubjects('cs:a a cs:Category ;\n  rdfs:label "open'),
    ).toThrow("cs:a: Unterminated literal");
  });
});

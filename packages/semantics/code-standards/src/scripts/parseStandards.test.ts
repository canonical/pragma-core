import { describe, expect, it } from "vitest";
import parseStandards from "./parseStandards.js";

describe("parseStandards", () => {
  it("reads each standard with a category, sorted by IRI", () => {
    const turtle = `cs:b a cs:CodeStandard ;
    rdfs:label "B"@en ;
    cs:hasCategory cs:root ;
    cs:description "Bee." .

# A comment that isn't part of either standard.
cs:a a cs:CodeStandard ;
    cs:hasCategory cs:root .

cs:none a cs:CodeStandard ;
    rdfs:label "Uncategorised"@en .`;

    expect(parseStandards(turtle)).toEqual([
      {
        id: "cs:a",
        name: "",
        description: "",
        categoryRef: "cs:root",
        dos: [],
        donts: [],
      },
      {
        id: "cs:b",
        name: "B",
        description: "Bee.",
        categoryRef: "cs:root",
        dos: [],
        donts: [],
      },
    ]);
  });

  it("reads the standard's own description, wherever its examples sit", () => {
    const [standard] = parseStandards(`cs:x a cs:CodeStandard ;
    cs:hasCategory cs:root ;
    cs:do [ cs:description """The example's.""" ] ;
    cs:description "The standard's." .`);

    expect(standard?.description).toBe("The standard's.");
    expect(standard?.dos).toEqual([
      { description: "The example's.", language: "", code: "" },
    ]);
  });

  it("reads the category outside the examples", () => {
    expect(
      parseStandards(`cs:x a cs:CodeStandard ;
    cs:do [ cs:code """cs:hasCategory cs:wrong""" ] ;
    cs:hasCategory cs:right .`).at(0)?.categoryRef,
    ).toBe("cs:right");
  });

  it("leaves a statement's closing dot out of the category", () => {
    expect(
      parseStandards(
        "cs:x a cs:CodeStandard ;\n    cs:hasCategory cs:react.",
      ).at(0)?.categoryRef,
    ).toBe("cs:react");
  });

  it("refuses a standard with two descriptions, naming it", () => {
    expect(() =>
      parseStandards(`cs:x a cs:CodeStandard ;
    cs:hasCategory cs:root ;
    cs:description "One." ;
    cs:description "Two." .`),
    ).toThrow("cs:x: More than one cs:description");
  });

  it("names the standard whose literal it cannot read", () => {
    expect(() =>
      parseStandards(`cs:x a cs:CodeStandard ;
    cs:hasCategory cs:root ;
    cs:description "Never closed ;`),
    ).toThrow("cs:x: Unterminated literal");
  });
});

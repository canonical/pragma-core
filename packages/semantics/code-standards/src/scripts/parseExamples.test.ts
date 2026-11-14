import { describe, expect, it } from "vitest";
import parseExamples from "./parseExamples.js";

describe("parseExamples", () => {
  it("reads each example's description, language and code", () => {
    const block = `cs:do [
        cs:description "Do this" ;
        cs:language "css" ;
        cs:code """
a {}
    """
    ] ;
    cs:dont [ cs:description "Not this" ] .`;

    expect(parseExamples(block, "cs:do")).toEqual([
      { description: "Do this", language: "css", code: "a {}" },
    ]);
    expect(parseExamples(block, "cs:dont")).toEqual([
      { description: "Not this", language: "", code: "" },
    ]);
  });
});

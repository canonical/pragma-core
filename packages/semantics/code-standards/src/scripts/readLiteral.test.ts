import { describe, expect, it } from "vitest";
import readLiteral from "./readLiteral.js";

describe("readLiteral", () => {
  it("reads a quoted literal whole, past its escaped quotes", () => {
    expect(
      readLiteral(
        'cs:description "Set `data-mode=\\"placing\\"`." ;',
        "cs:description",
      ),
    ).toBe('Set `data-mode="placing"`.');
  });

  it("decodes and trims a triple-quoted literal", () => {
    expect(readLiteral('cs:code """\n/a\\\\.b/\n    """', "cs:code")).toBe(
      "/a\\.b/",
    );
  });

  it("reads single-quoted literals in both lengths", () => {
    expect(readLiteral("cs:slug 'one' .", "cs:slug")).toBe("one");
    expect(readLiteral("cs:code '''two''' .", "cs:code")).toBe("two");
  });

  it("reads past a language tag, a datatype or a comment", () => {
    expect(readLiteral('rdfs:label "Name"@en ;', "rdfs:label")).toBe("Name");
    expect(readLiteral('cs:slug "x"^^xsd:string .', "cs:slug")).toBe("x");
    expect(readLiteral('cs:slug "x" # a note\n .', "cs:slug")).toBe("x");
  });

  it("skips a predicate that appears inside another literal", () => {
    expect(
      readLiteral(
        'cs:code """cs:description "inside" """ ; cs:description "outside" .',
        "cs:description",
      ),
    ).toBe("outside");
  });

  it("returns an empty string when the predicate is absent or has no literal", () => {
    expect(readLiteral('cs:code "x" .', "cs:description")).toBe("");
    expect(readLiteral("cs:description cs:x .", "cs:description")).toBe("");
  });

  it("refuses an unterminated literal", () => {
    expect(() => readLiteral('cs:description "open', "cs:description")).toThrow(
      "Unterminated literal",
    );
  });

  it("refuses anything but the end of a statement part after the literal", () => {
    expect(() =>
      readLiteral('cs:description "cut" short" ;', "cs:description"),
    ).toThrow('Unexpected "s" after the cs:description literal');
  });
});

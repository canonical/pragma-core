import { describe, expect, it } from "vitest";
import findBlankNodes from "./findBlankNodes.js";

describe("findBlankNodes", () => {
  it("returns the inside of each blank node of the predicate", () => {
    expect(
      findBlankNodes(
        "cs:do [ a ] ; cs:dont [ b ] ; cs:do [ c ] .",
        "cs:do",
      ).map((node) => node.text),
    ).toEqual([" a ", " c "]);
  });

  it("matches nested brackets and skips those inside literals", () => {
    expect(findBlankNodes('cs:do [ x [ y ] "]" ] .', "cs:do").at(0)).toEqual({
      index: 7,
      end: 20,
      text: ' x [ y ] "]" ',
    });
  });

  it("refuses a blank node left open", () => {
    expect(() => findBlankNodes("cs:do [ a ;", "cs:do")).toThrow(
      "Unclosed cs:do example",
    );
  });
});

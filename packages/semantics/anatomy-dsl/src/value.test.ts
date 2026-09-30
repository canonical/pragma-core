import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DUPLICATE_KEY, SECOND_DOCUMENT } from "../testing/fixtures.js";
import { AnatomySyntaxError } from "./document/index.js";
import { parseAnatomyYAML } from "./parse.js";
import {
  AnatomyValueError,
  authoredSpelling,
  classifyElement,
  liftSymbols,
  parseStyleValue,
  RULES,
} from "./value.js";

interface Fixture {
  values: { case: string; value: unknown; symbols: string[] }[];
  rejections: { case: string; value: unknown; rule: keyof typeof RULES }[];
  names: { case: string; variable: string; symbol: string }[];
}

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "..", "definitions", "lift.fixture.json"),
    "utf8",
  ),
) as Fixture;

describe("the value grammar", () => {
  it("reads a symbol, whatever segment shapes it carries", () => {
    for (const text of [
      "color.text",
      "dimension.100",
      "typography.weight.semiBold",
      "color.focusRing",
      "modifier.color.text",
      "surface.color.foreground.checkbox.unselected",
    ]) {
      expect(classifyElement(text)).toEqual({ kind: "symbol", text });
    }
  });

  it("reads each primitive form the ADR lists", () => {
    expect(classifyElement("currentColor")).toMatchObject({ form: "keyword" });
    expect(classifyElement("inherit")).toMatchObject({ form: "keyword" });
    // The ADR's Keyword production is [a-zA-Z]+ and the reference uses
    // hyphenated keywords throughout, so the production is widened to the
    // shape of a CSS keyword. It still admits no symbol: a symbol has a dot.
    expect(classifyElement("not-allowed")).toMatchObject({ form: "keyword" });
    expect(classifyElement("space-between")).toMatchObject({
      form: "keyword",
    });
    expect(classifyElement("0")).toMatchObject({ form: "number" });
    expect(classifyElement("1.6")).toMatchObject({ form: "number" });
    expect(classifyElement("-1")).toMatchObject({ form: "number" });
    expect(classifyElement("2px")).toMatchObject({ form: "dimension" });
    expect(classifyElement("0.25ch")).toMatchObject({ form: "dimension" });
    expect(classifyElement("0%")).toMatchObject({ form: "dimension" });
    expect(classifyElement("#ccc")).toMatchObject({ form: "color" });
    expect(classifyElement("#0f172aff")).toMatchObject({ form: "color" });
    // Quoted: any text. A tail that holds a space or a slash, or that a bare
    // YAML would read as something else.
    expect(classifyElement("1 / -1")).toMatchObject({ form: "quoted" });
    expect(classifyElement("*")).toMatchObject({ form: "quoted" });
  });

  it("reads a sequence as the fallback order", () => {
    const value = parseStyleValue([
      "modifier.color.icon",
      "modifier.color.text",
      "currentColor",
    ]);
    expect(value.list).toBe(true);
    expect(value.elements.map((e) => e.kind)).toEqual([
      "symbol",
      "symbol",
      "primitive",
    ]);
  });

  it("keeps the authored spelling verbatim, sequence included", () => {
    expect(authoredSpelling("color.text")).toBe("color.text");
    expect(authoredSpelling(["modifier.color.text", "color.text"])).toBe(
      "[modifier.color.text, color.text]",
    );
  });

  it("rejects the retired notation, naming the value and the rule", () => {
    const cases: [unknown, string][] = [
      ["spacing/medium", RULES.slashPath],
      ["dimension/radius/sth", RULES.slashPath],
      [
        ["modifier/color/foreground", "color/foreground/primary"],
        RULES.slashPath,
      ],
      ["color/surface/button?", RULES.slashPath],
      ["color.surface.button?", RULES.marker],
      ["$root", RULES.root],
      ["color.$root.text", RULES.root],
      [["2px", "dimension.stroke.thickness.large"], RULES.primitiveNotLast],
      [["color.text"], RULES.singleton],
    ];
    for (const [value, rule] of cases) {
      let thrown: unknown;
      try {
        parseStyleValue(value, "typography.color");
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(AnatomyValueError);
      const error = thrown as AnatomyValueError;
      expect(error.rule).toBe(rule);
      expect(error.message).toContain("typography.color");
      // The offending value is in the message, so a corpus of 134 anatomies
      // reports which binding failed and not merely that one did.
      expect(error.message).toContain(error.value);
    }
  });

  it("lifts only the symbols, in order", () => {
    expect(liftSymbols("color.text")).toEqual(["color.text"]);
    expect(liftSymbols(["modifier.color.text", "color.text"])).toEqual([
      "modifier.color.text",
      "color.text",
    ]);
    expect(liftSymbols(["dimension.100", "0"])).toEqual(["dimension.100"]);
    expect(liftSymbols("flow")).toEqual([]);
  });

  it("agrees with definitions/lift.fixture.json, case by case", () => {
    // The fixture is the committed contract J-3 reads: both repositories lift
    // identically or one of them goes red.
    for (const row of fixture.values) {
      expect(liftSymbols(row.value), row.case).toEqual(row.symbols);
    }
    for (const row of fixture.rejections) {
      let thrown: unknown;
      try {
        parseStyleValue(row.value);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, row.case).toBeInstanceOf(AnatomyValueError);
      expect((thrown as AnatomyValueError).rule, row.case).toBe(
        RULES[row.rule],
      );
    }
  });

  it("ships the CSS-name lift cases design-system implements", () => {
    // J-2 does not implement the name lift — it needs S4 to run — but it
    // ships the expected pairs so the two repositories agree on them.
    expect(fixture.names.length).toBeGreaterThan(10);
    for (const row of fixture.names) {
      expect(row.variable.startsWith("--"), row.case).toBe(true);
      expect(row.symbol, row.case).toMatch(/^[a-z]+(\.[A-Za-z0-9]+)+$/);
    }
  });
});

describe("parseAnatomyYAML", () => {
  it("parses the document text, which is what design-system holds", () => {
    const spec = parseAnatomyYAML(`---
node:
  uri: global.component.button
  styles:
    typography.color: [modifier.color.text, color.text]
    layout.type: flow
`);
    expect(spec.root.styles).toEqual([
      {
        key: "typography.color",
        value: "[modifier.color.text, color.text]",
        symbols: ["modifier.color.text", "color.text"],
      },
      { key: "layout.type", value: "flow", symbols: [] },
    ]);
  });

  it("still accepts an already-parsed document", () => {
    const spec = parseAnatomyYAML({
      node: {
        uri: "global.component.button",
        styles: { "appearance.background@hover": "color.foreground.primary" },
      },
    });
    expect(spec.root.styles?.[0]).toEqual({
      key: "appearance.background",
      state: "hover",
      value: "color.foreground.primary",
      symbols: ["color.foreground.primary"],
    });
  });

  it("refuses a document that is not one", () => {
    expect(() => parseAnatomyYAML("just a scalar")).toThrow("one `node` key");
    expect(() => parseAnatomyYAML("")).toThrow("one `node` key");
  });

  it("refuses text that is not well-formed YAML, with the error's location", () => {
    expect(() => parseAnatomyYAML(DUPLICATE_KEY)).toThrow(
      "YAML syntax error at line 3, column 3: Map keys must be unique",
    );
    expect(() => parseAnatomyYAML(SECOND_DOCUMENT)).toThrow(AnatomySyntaxError);
  });

  it("names the failing binding when a value is rejected", () => {
    expect(() =>
      parseAnatomyYAML(`---
node:
  uri: global.component.button
  styles:
    appearance.background: color/surface/button?
`),
    ).toThrow(/appearance\.background.*color\/surface\/button\?/);
  });
});

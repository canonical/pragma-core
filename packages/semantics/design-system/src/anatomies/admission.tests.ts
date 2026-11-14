import { describe, expect, it } from "vitest";
import { NAMESPACES } from "../constants.js";
import {
  type BindingFinding,
  deriveBindingRecords,
  type RegisterRow,
} from "../transform/tokenBindings.js";
import {
  admitRegistered,
  classifyAdmission,
  classifyParseFailure,
  danglingReference,
} from "./admission.js";

const ds = NAMESPACES.ds;

/** A derivation finding about `global.component.x`, as the walk emits it. */
function buildFinding(code: string, message: string): BindingFinding {
  return {
    code,
    severity: "finding",
    message,
    block: `${ds}global.component.x`,
  };
}

/** An X16 row for `global.component.x` with the reason given. */
function buildX16Row(value: string): RegisterRow {
  return {
    uri: "global.component.x",
    node: null,
    key: null,
    state: null,
    value,
    category: "X16",
    considered: [],
    date: "2026-11-14",
  };
}

/** The one finding the derivation reports for `text`, through the real parser. */
function deriveFinding(text: string): BindingFinding {
  const { findings } = deriveBindingRecords(
    new Map([[`${ds}global.component.x`, text]]),
  );
  expect(findings).toHaveLength(1);
  return findings[0];
}

const UNKNOWN_KEY = deriveFinding(
  "node:\n  uri: global.component.x\n  style:\n    layout.type: flow\n",
);

describe("classifyParseFailure", () => {
  it("maps each failure to a stable reason, not to the parser's prose", () => {
    expect(
      classifyParseFailure("… the slash-delimited token path is retired …"),
    ).toBe("retired-slash-path");
    expect(classifyParseFailure("… the trailing `?` marker is retired …")).toBe(
      "retired-marker",
    );
    expect(classifyParseFailure("… a primitive may only end a value: …")).toBe(
      "primitive-not-last",
    );
    expect(
      classifyParseFailure(
        "An anatomy document is a mapping with one `node` key",
      ),
    ).toBe("not-an-anatomy");
    expect(
      classifyParseFailure("Implicit keys need to be on a single line"),
    ).toBe("yaml-error");
  });
});

describe("danglingReference", () => {
  it("takes the uri: out of the finding", () => {
    expect(
      danglingReference(
        "a: uri: global.component.gone resolves to no ds: subject",
      ),
    ).toBe("global.component.gone");
  });
});

describe("classifyAdmission", () => {
  it("files a dangling uri: under X11, by the uri it names", () => {
    expect(
      classifyAdmission(
        buildFinding(
          "X11",
          "a: uri: global.component.gone resolves to no ds: subject",
        ),
      ),
    ).toEqual({ category: "X11", value: "global.component.gone" });
  });

  it("files each key the real parser rejects under X16, by the reason the derivation carries", () => {
    const cases: [string, string][] = [
      [
        "node:\n  uri: global.component.x\n  style:\n    layout.type: flow\n",
        "unknown-key",
      ],
      [
        "node:\n  uri: global.component.x\n  edges:\n    - uri: global.component.y\n",
        "malformed-key",
      ],
      ["{}\n", "not-an-anatomy"],
      ["node:\n", "not-an-anatomy"],
      // A mapping with foreign keys and no `node` names its first foreign key, a
      // bare `uri:` and a prose line with a colon alike.
      ["uri: global.component.x\n", "unknown-key"],
      ["Note: this cell is prose\n", "unknown-key"],
    ];
    for (const [text, value] of cases) {
      const finding = deriveFinding(text);
      expect(finding.code, text).toBe("AT23");
      expect(classifyAdmission(finding), text).toEqual({
        category: "X16",
        value,
      });
    }
  });

  it("files a document that is not a mapping under X16 as not-an-anatomy", () => {
    for (const text of ["just a line of prose\n", "- a\n- b\n"]) {
      const finding = deriveFinding(text);
      expect(finding.code, text).toBe("X16");
      expect(classifyAdmission(finding), text).toEqual({
        category: "X16",
        value: "not-an-anatomy",
      });
    }
  });

  it("files any other parse failure under X16 by its classified reason", () => {
    expect(
      classifyAdmission(
        buildFinding("X16", "x — the slash-delimited token path is retired"),
      ),
    ).toEqual({ category: "X16", value: "retired-slash-path" });
  });
});

describe("admitRegistered", () => {
  it("admits an unknown key through an X16 unknown-key row", () => {
    expect(
      admitRegistered([UNKNOWN_KEY], [buildX16Row("unknown-key")]),
    ).toEqual([]);
  });

  it("does not admit it through an X16 row with another reason", () => {
    expect(
      admitRegistered([UNKNOWN_KEY], [buildX16Row("retired-slash-path")]),
    ).toEqual([UNKNOWN_KEY]);
  });
});

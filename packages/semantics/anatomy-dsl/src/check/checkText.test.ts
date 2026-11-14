import { describe, expect, it } from "vitest";
import {
  ALIASED_PROJECTION,
  ALIASED_STYLES,
  BARE_FLOW_KEY,
  COLLECTION_KEY,
  COMPOUND_STATE,
  DIFFERENT_RULE_FIRST,
  DUPLICATE_KEY,
  EDGE_LEVEL_EDGES,
  EDGE_WITHOUT_TARGET,
  EMPTY_CASE_NODE,
  EMPTY_CASE_URI,
  EMPTY_VALUE,
  FLOW_ALIAS,
  MINIMAL,
  MISSING_CARDINALITY,
  MISSING_RELATION,
  NO_NODE,
  NOT_A_MAPPING,
  PRIMITIVE_NOT_LAST,
  PRIMITIVE_NOT_LAST_MESSAGE,
  PROPS_SEQUENCE,
  SAME_KEY,
  SECOND_DOCUMENT,
  STATE_SUFFIXED,
  UNCLOSED_FLOW,
  UNCLOSED_FLOW_REASON,
  UNKNOWN_KEY,
} from "../../testing/fixtures.js";
import { MULTIPLE_DOCUMENTS_REASON } from "../document/index.js";
import { RULES } from "../value.js";
import checkText from "./checkText.js";

describe("checkText", () => {
  it("returns undefined for an anatomy that parses", () => {
    expect(checkText(MINIMAL)).toBeUndefined();
  });

  it("locates the element of a sequence that breaks a value rule", () => {
    expect(checkText(PRIMITIVE_NOT_LAST)).toEqual({
      message: PRIMITIVE_NOT_LAST_MESSAGE,
      line: 4,
      col: 23,
    });
  });

  it("locates a value under a state-suffixed key", () => {
    expect(checkText(STATE_SUFFIXED)).toEqual({
      message: `style value of appearance.background "color/background/hover" is rejected: ${RULES.slashPath}`,
      line: 4,
      col: 34,
    });
  });

  it("locates the style that breaks the rule, not a prop or a valid style of the same name", () => {
    expect(checkText(SAME_KEY)).toEqual({
      message: `style value of gap "x/y" is rejected: ${RULES.slashPath}`,
      line: 11,
      col: 16,
    });
  });

  it("locates a value in a flow map and behind an alias", () => {
    expect(checkText(FLOW_ALIAS)).toEqual({
      message: `style value of layout.gap "x/y" is rejected: ${RULES.slashPath}`,
      line: 4,
      col: 43,
    });
  });

  it("locates a YAML syntax error, reported by its reason", () => {
    expect(checkText(UNCLOSED_FLOW)).toEqual({
      message: UNCLOSED_FLOW_REASON,
      line: 5,
      col: 1,
    });
  });

  it("locates a duplicate key", () => {
    expect(checkText(DUPLICATE_KEY)).toEqual({
      message: "Map keys must be unique",
      line: 3,
      col: 3,
    });
  });

  it("locates a second document", () => {
    expect(checkText(SECOND_DOCUMENT)).toEqual({
      message: MULTIPLE_DOCUMENTS_REASON,
      line: 3,
      col: 1,
    });
  });

  it("locates the key of a document without a top-level node key", () => {
    expect(checkText(NO_NODE)).toEqual({
      message:
        'unknown anatomy key "uri" at the document: not a key of this mapping, which takes `node`',
      line: 1,
      col: 1,
    });
  });

  it("reports text that is not a mapping without a location", () => {
    expect(checkText(NOT_A_MAPPING)).toEqual({
      message: "An anatomy document is a mapping with one `node` key",
    });
  });

  it("locates an edge without a target at the edge", () => {
    expect(checkText(EDGE_WITHOUT_TARGET)).toEqual({
      message:
        'anatomy key "node" at node.edges[0]: an edge needs one target: `node`, `uri` or `switch`',
      line: 4,
      col: 7,
    });
  });

  it("locates an empty case uri and an empty case node at the case", () => {
    expect(checkText(EMPTY_CASE_URI)).toMatchObject({ line: 8, col: 13 });
    expect(checkText(EMPTY_CASE_NODE)).toMatchObject({ line: 7, col: 13 });
  });

  it("reports a rejected value without a location when the styles come through an alias", () => {
    expect(checkText(ALIASED_STYLES)).toEqual({
      message: `style value of gap "x/y" is rejected: ${RULES.slashPath}`,
    });
  });

  it("locates a style key that has no value after its colon", () => {
    expect(checkText(EMPTY_VALUE)).toEqual({
      message: `style value of gap "null" is rejected: ${RULES.empty}`,
      line: 4,
      col: 9,
    });
  });

  it("passes over a collection used as a style key", () => {
    expect(checkText(COLLECTION_KEY)).toEqual({
      message: `style value of gap "x/y" is rejected: ${RULES.slashPath}`,
      line: 6,
      col: 10,
    });
  });

  it("passes over an earlier style under the same key that breaks a different rule", () => {
    expect(checkText(DIFFERENT_RULE_FIRST)).toEqual({
      message: `style value of gap "x/y" is rejected: ${RULES.slashPath}`,
      line: 11,
      col: 10,
    });
  });

  it("locates an unknown key at the key", () => {
    expect(checkText(UNKNOWN_KEY)).toEqual({
      message:
        'unknown anatomy key "style" at node: not a key of this mapping, which takes `uri`, `projection`, `props`, `styles`, `edges`',
      line: 3,
      col: 3,
    });
  });

  it("locates an edge-level edges key, with the repair in the message", () => {
    expect(checkText(EDGE_LEVEL_EDGES)).toEqual({
      message:
        'unknown anatomy key "edges" at node.edges[0]: an edge takes no `edges` — it belongs inside the edge\'s `node:` mapping',
      line: 7,
      col: 7,
    });
  });

  it("locates a missing relation at the edge that lacks it", () => {
    expect(checkText(MISSING_RELATION)).toMatchObject({ line: 4, col: 7 });
  });

  it("locates a rejected state marker at its style key", () => {
    expect(checkText(COMPOUND_STATE)).toMatchObject({
      message: expect.stringContaining("Compound states are not yet supported"),
      line: 4,
      col: 5,
    });
  });

  it("locates a missing cardinality at the relation that lacks it", () => {
    expect(checkText(MISSING_CARDINALITY)).toMatchObject({
      message: expect.stringContaining("a relation needs its `cardinality`"),
      line: 6,
      col: 9,
    });
  });

  it("locates a container of the wrong shape at its key", () => {
    expect(checkText(PROPS_SEQUENCE)).toEqual({
      message: 'anatomy key "props" at node: `props` takes a mapping',
      line: 3,
      col: 3,
    });
  });

  it("locates a key rejected in an aliased mapping at the alias", () => {
    expect(checkText(ALIASED_PROJECTION)).toEqual({
      message:
        'unknown anatomy key "on" at node.edges[0].relation.projection: not a key of this mapping, which takes `field`',
      line: 6,
      col: 52,
    });
  });

  it("locates a bare key in a flow map at the key", () => {
    expect(checkText(BARE_FLOW_KEY)).toEqual({
      message: `style value of gap "null" is rejected: ${RULES.empty}`,
      line: 3,
      col: 12,
    });
  });
});

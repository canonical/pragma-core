import { describe, expect, it } from "vitest";
import {
  EDGE_WITHOUT_TARGET,
  FLOW_ALIAS,
  MINIMAL,
  NO_NODE,
  PRIMITIVE_NOT_LAST,
  PRIMITIVE_NOT_LAST_MESSAGE,
  SAME_KEY,
  STATE_SUFFIXED,
} from "../../testing/fixtures.js";
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

  it("reports a document without a top-level node key", () => {
    expect(checkText(NO_NODE)).toEqual({
      message: "An anatomy document is a mapping with one `node` key",
    });
  });

  it("reports a structural error without a location", () => {
    expect(checkText(EDGE_WITHOUT_TARGET)).toEqual({
      message: "Edge must have node, uri, or switch",
    });
  });
});

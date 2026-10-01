import { describe, expect, it } from "vitest";
import { LineCounter } from "yaml";
import {
  DUPLICATE_KEY,
  MINIMAL,
  SECOND_DOCUMENT,
  UNCLOSED_FLOW,
  UNCLOSED_FLOW_REASON,
} from "../../testing/fixtures.js";
import AnatomySyntaxError from "./AnatomySyntaxError.js";
import { MULTIPLE_DOCUMENTS_REASON } from "./constants.js";
import parseAnatomyDocument from "./parseAnatomyDocument.js";

/** The error `parseAnatomyDocument` throws on `text`. */
function catchSyntaxError(text: string): AnatomySyntaxError {
  try {
    parseAnatomyDocument(text);
  } catch (error) {
    return error as AnatomySyntaxError;
  }
  throw new Error("expected the text to be rejected");
}

describe("parseAnatomyDocument", () => {
  it("returns the document of well-formed text", () => {
    expect(parseAnatomyDocument(MINIMAL).toJS()).toEqual({
      node: { uri: "global.component.button" },
    });
  });

  it("records the line starts in the line counter it is given", () => {
    const lineCounter = new LineCounter();
    parseAnatomyDocument(MINIMAL, lineCounter);
    expect(lineCounter.linePos(MINIMAL.indexOf("uri"))).toEqual({
      line: 2,
      col: 3,
    });
  });

  it("rejects an unclosed flow sequence where the document ends", () => {
    const error = catchSyntaxError(UNCLOSED_FLOW);
    expect(error).toBeInstanceOf(AnatomySyntaxError);
    expect(error).toMatchObject({
      reason: UNCLOSED_FLOW_REASON,
      line: 5,
      col: 1,
    });
  });

  it("rejects a duplicate key at the second one", () => {
    expect(catchSyntaxError(DUPLICATE_KEY)).toMatchObject({
      reason: "Map keys must be unique",
      line: 3,
      col: 3,
    });
  });

  it("rejects a second document at its marker, in the anatomy's own words", () => {
    expect(catchSyntaxError(SECOND_DOCUMENT)).toMatchObject({
      reason: MULTIPLE_DOCUMENTS_REASON,
      line: 3,
      col: 1,
    });
  });
});

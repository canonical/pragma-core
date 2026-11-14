import { describe, expect, it } from "vitest";
import { MINIMAL, NO_NODE, UNKNOWN_KEY } from "../../testing/fixtures.js";
import AnatomyKeyError from "../AnatomyKeyError.js";
import { parseAnatomyDocument } from "../document/index.js";
import locateKey from "./locateKey.js";

/** An error naming `key` in the mapping at `path`, as the parser raises it. */
function buildKeyError(
  key: string,
  path: (string | number)[],
): AnatomyKeyError {
  return new AnatomyKeyError(key, path, [], "rule");
}

describe("locateKey", () => {
  it("finds the key in the mapping the path reaches", () => {
    expect(
      locateKey(
        parseAnatomyDocument(UNKNOWN_KEY),
        buildKeyError("style", ["node"]),
      ),
    ).toBe(UNKNOWN_KEY.indexOf("style"));
  });

  it("finds a key of the document itself", () => {
    expect(
      locateKey(parseAnatomyDocument(NO_NODE), buildKeyError("uri", [])),
    ).toBe(0);
  });

  it("falls back to the mapping when the key is absent from it", () => {
    expect(
      locateKey(
        parseAnatomyDocument(MINIMAL),
        buildKeyError("relation", ["node"]),
      ),
    ).toBe(MINIMAL.indexOf("uri"));
  });

  it("returns undefined when the path reaches no node", () => {
    expect(
      locateKey(
        parseAnatomyDocument(MINIMAL),
        buildKeyError("relation", ["node", "edges", 0]),
      ),
    ).toBeUndefined();
  });
});

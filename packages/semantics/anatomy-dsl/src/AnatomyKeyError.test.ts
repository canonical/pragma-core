import { describe, expect, it } from "vitest";
import AnatomyKeyError from "./AnatomyKeyError.js";

describe("AnatomyKeyError", () => {
  it("carries the key, the path to its mapping and the keys that mapping takes", () => {
    const error = new AnatomyKeyError(
      "edges",
      ["node", "edges", 0],
      ["node", "uri", "switch", "relation"],
      "belongs inside the edge's `node:` mapping",
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AnatomyKeyError");
    expect(error.key).toBe("edges");
    expect(error.path).toEqual(["node", "edges", 0]);
    expect(error.allowed).toEqual(["node", "uri", "switch", "relation"]);
    expect(error.message).toBe(
      'unknown anatomy key "edges" at node.edges[0]: belongs inside the edge\'s `node:` mapping',
    );
  });

  it("names the document itself for a key at the root", () => {
    expect(new AnatomyKeyError("uri", [], ["node"], "rule").message).toBe(
      'unknown anatomy key "uri" at the document: rule',
    );
  });

  it("drops the word unknown for a key the mapping takes", () => {
    expect(new AnatomyKeyError("node", [], ["node"], "rule").message).toBe(
      'anatomy key "node" at the document: rule',
    );
  });
});

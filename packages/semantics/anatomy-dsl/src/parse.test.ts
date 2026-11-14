import { describe, expect, it } from "vitest";
import AnatomyKeyError from "./AnatomyKeyError.js";
import { parseAnatomyYAML } from "./parse.js";

/** The error `parseAnatomyYAML` throws on `raw`. */
function catchKeyError(raw: unknown): AnatomyKeyError {
  try {
    parseAnatomyYAML(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(AnatomyKeyError);
    return error as AnatomyKeyError;
  }
  throw new Error("expected the document to be rejected");
}

const LABEL = { uri: "global.subcomponent.label" };
const ONE = { cardinality: "1" };

/** A root whose single edge is `edge`. */
function wrapEdge(edge: unknown): unknown {
  return { node: { uri: "global.component.x", edges: [edge] } };
}

describe("parseAnatomyYAML — closed mappings", () => {
  it("rejects an unknown key at every mapping level, naming its path", () => {
    const cases: { raw: unknown; key: string; path: (string | number)[] }[] = [
      {
        raw: { node: { uri: "global.component.x" }, extra: 1 },
        key: "extra",
        path: [],
      },
      {
        raw: { node: { uri: "global.component.x", style: {} } },
        key: "style",
        path: ["node"],
      },
      {
        raw: wrapEdge({
          node: { role: "row", label: "x" },
          relation: ONE,
        }),
        key: "label",
        path: ["node", "edges", 0, "node"],
      },
      {
        raw: wrapEdge({ node: LABEL, relation: ONE, slot: "default" }),
        key: "slot",
        path: ["node", "edges", 0],
      },
      {
        raw: wrapEdge({
          switch: { on: "props", discriminator: "kind", cases: [] },
          relation: ONE,
        }),
        key: "discriminator",
        path: ["node", "edges", 0, "switch"],
      },
      {
        raw: wrapEdge({
          switch: {
            on: "props",
            cases: [{ uri: "global.component.y", when: "a" }],
          },
          relation: ONE,
        }),
        key: "when",
        path: ["node", "edges", 0, "switch", "cases", 0],
      },
      {
        raw: wrapEdge({
          node: LABEL,
          relation: { cardinality: "1", slot: "x" },
        }),
        key: "slot",
        path: ["node", "edges", 0, "relation"],
      },
      {
        raw: {
          node: {
            uri: "global.component.x",
            projection: { on: "T", type: "T" },
          },
        },
        key: "type",
        path: ["node", "projection"],
      },
      {
        raw: wrapEdge({
          node: LABEL,
          relation: {
            cardinality: "0..*",
            projection: { field: "f", on: "T" },
          },
        }),
        key: "on",
        path: ["node", "edges", 0, "relation", "projection"],
      },
    ];
    for (const { raw, key, path } of cases) {
      const error = catchKeyError(raw);
      expect(error.key, key).toBe(key);
      expect(error.path, key).toEqual(path);
      expect(error.message, key).toContain("not a key of this mapping");
    }
  });

  it("lists the keys the mapping takes", () => {
    expect(
      catchKeyError({ node: { uri: "global.component.x", style: {} } }).allowed,
    ).toEqual(["uri", "projection", "props", "styles", "edges"]);
  });

  it("says where an edge-level edges key belongs", () => {
    const error = catchKeyError(
      wrapEdge({ node: LABEL, relation: ONE, edges: [] }),
    );
    expect(error.key).toBe("edges");
    expect(error.rule).toBe(
      "an edge takes no `edges` — it belongs inside the edge's `node:` mapping",
    );
  });

  it("rejects an edge with more than one target", () => {
    const error = catchKeyError(
      wrapEdge({ node: LABEL, uri: "global.component.y", relation: ONE }),
    );
    expect(error.key).toBe("uri");
    expect(error.rule).toBe(
      "an edge has exactly one target, and this one has `node` and `uri`",
    );
  });

  it("rejects a switch case with both uri and node", () => {
    const error = catchKeyError(
      wrapEdge({
        switch: {
          on: "props",
          cases: [{ uri: "global.component.y", node: LABEL }],
        },
        relation: ONE,
      }),
    );
    expect(error.key).toBe("node");
    expect(error.path).toEqual(["node", "edges", 0, "switch", "cases", 0]);
    expect(error.rule).toBe("a switch case has `uri` or `node`, never both");
  });

  it("rejects an edge without a relation", () => {
    for (const relation of [undefined, null]) {
      const error = catchKeyError(wrapEdge({ node: LABEL, relation }));
      expect(error.key).toBe("relation");
      expect(error.path).toEqual(["node", "edges", 0]);
    }
  });

  it("rejects a pin whose value is a mapping or a sequence", () => {
    for (const value of [{ channel: "modifier.icon" }, ["a", "b"]]) {
      const error = catchKeyError({
        node: { uri: "global.component.icon", props: { icon: value } },
      });
      expect(error.key).toBe("icon");
      expect(error.path).toEqual(["node", "props"]);
      expect(error.rule).toBe(
        "a pin's value is a scalar, never a mapping or a sequence",
      );
    }
  });

  it("rejects a container whose value has the wrong shape, at its key", () => {
    const named = (extra: Record<string, unknown>) => ({
      node: { uri: "global.component.x", ...extra },
    });
    const cases: { raw: unknown; key: string; rule: string }[] = [
      { raw: named({ props: ["x", "y"] }), key: "props", rule: "a mapping" },
      { raw: named({ props: "hello" }), key: "props", rule: "a mapping" },
      { raw: named({ styles: ["x"] }), key: "styles", rule: "a mapping" },
      { raw: named({ edges: "x" }), key: "edges", rule: "a sequence" },
      {
        raw: wrapEdge({ node: LABEL, relation: "one" }),
        key: "relation",
        rule: "a mapping",
      },
      { raw: { node: "global.component.x" }, key: "node", rule: "a mapping" },
    ];
    for (const { raw, key, rule } of cases) {
      const error = catchKeyError(raw);
      expect(error.key, key).toBe(key);
      expect(error.rule, key).toBe(`\`${key}\` takes ${rule}`);
    }
  });

  it("reads an empty container as absent", () => {
    expect(
      parseAnatomyYAML({ node: { uri: "global.component.x", props: null } })
        .root,
    ).toEqual({ type: "named", uri: "global.component.x" });
  });

  it("rejects a named node without its uri", () => {
    const error = catchKeyError({
      node: { styles: { "layout.type": "flow" } },
    });
    expect(error.key).toBe("uri");
    expect(error.path).toEqual(["node"]);
    expect(error.rule).toBe("a named node needs its `uri`");
  });

  it("rejects a relation without its cardinality", () => {
    for (const relation of [{ slotName: "s" }, { cardinality: 1 }]) {
      const error = catchKeyError(wrapEdge({ node: LABEL, relation }));
      expect(error.key).toBe("cardinality");
      expect(error.path).toEqual(["node", "edges", 0, "relation"]);
    }
  });

  it("rejects a switch without cases, on an unknown discriminator, or with an empty case", () => {
    const at = ["node", "edges", 0, "switch"];
    const withSwitch = (value: unknown) =>
      wrapEdge({ switch: value, relation: ONE });
    expect(catchKeyError(withSwitch({ on: "props" }))).toMatchObject({
      key: "cases",
      path: at,
    });
    expect(catchKeyError(withSwitch({ on: "state", cases: [] }))).toMatchObject(
      { key: "on", path: at },
    );
    for (const empty of [{}, "global.component.y", null]) {
      expect(
        catchKeyError(withSwitch({ on: "props", cases: [empty] })),
      ).toMatchObject({
        key: "uri",
        path: [...at, "cases", 0],
        rule: "a switch case has `uri` or `node`",
      });
    }
  });

  it("rejects an edge that is not a mapping, or that has no target", () => {
    for (const edge of [
      "global.component.y",
      { relation: ONE },
      { node: null, relation: ONE },
    ]) {
      expect(catchKeyError(wrapEdge(edge))).toMatchObject({
        key: "node",
        path: ["node", "edges", 0],
      });
    }
  });

  it("rejects a document without its node, an empty one included", () => {
    for (const raw of [{}, { node: null }]) {
      expect(catchKeyError(raw)).toMatchObject({ key: "node", path: [] });
    }
    expect(() => parseAnatomyYAML(["not", "a", "mapping"])).toThrow(
      "An anatomy document is a mapping with one `node` key",
    );
  });

  it("tells an anonymous root to be named", () => {
    expect(catchKeyError({ node: { role: "card" } })).toMatchObject({
      key: "role",
      rule: "the root node is named: give it a `uri`, not a `role`",
    });
  });

  it("rejects an anonymous node without its role", () => {
    for (const node of [
      { styles: { "layout.type": "flow" } },
      { role: null },
    ]) {
      expect(catchKeyError(wrapEdge({ node, relation: ONE }))).toMatchObject({
        key: "role",
        path: ["node", "edges", 0, "node"],
        rule: "an anonymous node needs its `role`, or a `uri` to be named",
      });
    }
  });

  it("rejects an empty case target, at the case", () => {
    const at = ["node", "edges", 0, "switch", "cases", 0];
    for (const empty of [{ uri: null }, { node: null }]) {
      expect(
        catchKeyError(
          wrapEdge({
            switch: {
              on: "props",
              cases: [empty, { uri: "global.component.y" }],
            },
            relation: ONE,
          }),
        ),
      ).toMatchObject({ key: "uri", path: at });
    }
  });

  it("rejects a name that is not a non-empty string", () => {
    const cases: { raw: unknown; key: string }[] = [
      { raw: wrapEdge({ uri: 123, relation: ONE }), key: "uri" },
      { raw: wrapEdge({ uri: true, relation: ONE }), key: "uri" },
      { raw: wrapEdge({ uri: "", relation: ONE }), key: "uri" },
      {
        raw: wrapEdge({
          node: LABEL,
          relation: { cardinality: "1", slotName: { a: 1 } },
        }),
        key: "slotName",
      },
      {
        raw: {
          node: { uri: "global.component.x", projection: { field: ["x"] } },
        },
        key: "field",
      },
      {
        raw: { node: { uri: "global.component.x", projection: { on: 3 } } },
        key: "on",
      },
      { raw: wrapEdge({ node: { role: 7 }, relation: ONE }), key: "role" },
    ];
    for (const { raw, key } of cases) {
      const error = catchKeyError(raw);
      expect(error.key, key).toBe(key);
      expect(error.rule, key).toBe(`\`${key}\` takes a non-empty string`);
    }
  });

  it("rejects a switch with fewer than two cases", () => {
    for (const cases of [[], [{ uri: "global.component.y" }]]) {
      expect(
        catchKeyError(
          wrapEdge({ switch: { on: "props", cases }, relation: ONE }),
        ),
      ).toMatchObject({ key: "cases", path: ["node", "edges", 0, "switch"] });
    }
  });

  it("rejects a pin without a value", () => {
    expect(
      catchKeyError({
        node: { uri: "global.component.icon", props: { icon: null } },
      }),
    ).toMatchObject({
      key: "icon",
      path: ["node", "props"],
      rule: "a pin needs a value",
    });
  });

  it("rejects a projection with neither on nor field, and a relation projection without field", () => {
    expect(
      catchKeyError({ node: { uri: "global.component.x", projection: {} } }),
    ).toMatchObject({ key: "on", path: ["node", "projection"] });
    expect(
      catchKeyError(
        wrapEdge({
          node: LABEL,
          relation: { cardinality: "1", projection: {} },
        }),
      ),
    ).toMatchObject({
      key: "field",
      path: ["node", "edges", 0, "relation", "projection"],
    });
  });

  it("names a misspelt key at the root and in a case, not the key it stands for", () => {
    expect(
      catchKeyError({ nodes: { uri: "global.component.x" } }),
    ).toMatchObject({
      key: "nodes",
      path: [],
    });
    const error = catchKeyError(
      wrapEdge({
        switch: {
          on: "props",
          cases: [{ url: "global.component.y" }, { uri: "global.component.z" }],
        },
        relation: ONE,
      }),
    );
    expect(error.key).toBe("url");
    expect(error.rule).toContain("not a key of this mapping");
  });

  it("reads a key with no value as absent, even one the mapping does not take", () => {
    expect(
      parseAnatomyYAML(
        wrapEdge({
          node: { role: "row", props: null },
          relation: ONE,
          edges: null,
        }),
      ).root.edges,
    ).toEqual([
      {
        target: { type: "anonymous", role: "row" },
        relation: { cardinality: "1" },
      },
    ]);
  });

  it("rejects an empty, compound or default state marker at the style key", () => {
    const markers: [string, string][] = [
      ["layout.type@", "empty state"],
      ["layout.type@hover@focus", "Compound states"],
      ["layout.type@default", 'drop "@default"'],
    ];
    for (const [rawKey, rule] of markers) {
      const error = catchKeyError({
        node: { uri: "global.component.x", styles: { [rawKey]: "flow" } },
      });
      expect(error.key, rawKey).toBe(rawKey);
      expect(error.path, rawKey).toEqual(["node", "styles"]);
      expect(error.rule, rawKey).toContain(rule);
    }
  });

  it("names the first foreign key of a mapping without node, and leaves non-mappings to a plain Error", () => {
    expect(catchKeyError("uri: global.component.x\n")).toMatchObject({
      key: "uri",
      path: [],
    });
    expect(catchKeyError("Note: this is prose\n")).toMatchObject({
      key: "Note",
    });
    for (const text of ["", "just a line of prose\n", "- a\n- b\n"]) {
      expect(() => parseAnatomyYAML(text)).toThrow(
        "An anatomy document is a mapping with one `node` key",
      );
      expect(() => parseAnatomyYAML(text)).not.toThrow(AnatomyKeyError);
    }
  });
});

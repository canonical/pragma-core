import { Parser } from "n3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TableTransform } from "../config/types.js";
import { GraphStore, PrefixMap } from "../graph/index.js";
import serializeToTurtle from "../serializers/TTLSerializer.js";
import transformRow from "./transformRow.js";
import type { ReferenceMap } from "./types.js";

/**
 * Regression test for the malformed-reference bug that shipped invalid Turtle
 * in the design-system `data/*.ttl` files (e.g. `ds:hasSubcomponent ds:global..`)
 * and broke the pragma CLI's ke store boot.
 */

function prefixes(): PrefixMap {
  const pm = new PrefixMap();
  pm.add("ds", "https://ds.canonical.com/");
  return pm;
}

const config: TableTransform = {
  uriTemplate: "{uri}",
  class: "ds:Component",
  "@context": {
    subcomponents: { "@id": "ds:hasSubcomponent", "@type": "@id" },
  },
};

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("transformRow — malformed reference handling", () => {
  it("emits valid subcomponents and skips a degenerate one, warning about it", () => {
    const store = new GraphStore();
    // A dangling reference resolves to a degenerate `ds:global..` — the exact
    // shape that made card.ttl unparseable.
    const refMap: ReferenceMap = new Map([
      ["#footer", "ds:global.subcomponent.card-footer"],
      ["#blank", "ds:global.."],
    ]);

    const subject = transformRow(
      { uri: "ds:global.component.card", subcomponents: "#footer,#blank" },
      config,
      store,
      prefixes(),
      refMap,
    );

    expect(subject).toBe("https://ds.canonical.com/global.component.card");

    const objects = store
      .getQuads()
      .filter((q) => q.predicate.value.endsWith("hasSubcomponent"))
      .map((q) => q.object.value);

    expect(objects).toContain(
      "https://ds.canonical.com/global.subcomponent.card-footer",
    );
    expect(objects).not.toContain("https://ds.canonical.com/global..");
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("produces Turtle that parses cleanly even when a reference is malformed", async () => {
    const store = new GraphStore();
    const refMap: ReferenceMap = new Map([
      ["#footer", "ds:global.subcomponent.card-footer"],
      ["#blank", "ds:global.."],
    ]);
    const pm = prefixes();

    transformRow(
      { uri: "ds:global.component.card", subcomponents: "#footer,#blank" },
      config,
      store,
      pm,
      refMap,
    );

    const turtle = await serializeToTurtle(store, { prefixes: pm });

    // The previously-shipped bug produced `ds:global..`, which throws here.
    expect(() => new Parser().parse(turtle)).not.toThrow();
    expect(turtle).not.toContain("global..");
  });

  it("skips and warns for a row whose own subject URI is degenerate", () => {
    const store = new GraphStore();

    const subject = transformRow(
      { uri: "ds:global..", subcomponents: "" },
      config,
      store,
      prefixes(),
      new Map(),
    );

    expect(subject).toBeNull();
    expect(store.getQuads()).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain(
      "malformed subject URI",
    );
  });

  it("skips an empty subject URI silently (routine, not a warning)", () => {
    const store = new GraphStore();

    const subject = transformRow(
      { uri: "", subcomponents: "" },
      config,
      store,
      prefixes(),
      new Map(),
    );

    expect(subject).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

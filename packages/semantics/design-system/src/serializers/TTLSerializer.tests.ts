import { describe, expect, it } from "vitest";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore, PrefixMap } from "../graph/index.js";
import serializeToTurtle from "./TTLSerializer.js";

const buttonUri = `${NAMESPACES.ds}button`;
const globalUri = `${NAMESPACES.ds}global`;
const componentType = `${NAMESPACES.ds}Component`;

function createPrefixMap(): PrefixMap {
  const prefixes = new PrefixMap();
  prefixes.add("ds", NAMESPACES.ds);
  prefixes.add("rdf", NAMESPACES.rdf);
  return prefixes;
}

describe("serializeToTurtle", () => {
  it("should serialize empty store", async () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();

    const ttl = await serializeToTurtle(store, { prefixes });

    expect(ttl).toBe("");
  });

  it("should include prefix declarations", async () => {
    const store = new GraphStore();
    store.addQuad(buttonUri, PREDICATES.type, componentType);

    const prefixes = createPrefixMap();
    const ttl = await serializeToTurtle(store, { prefixes });

    expect(ttl).toContain("@prefix ds:");
    expect(ttl).toContain("@prefix rdf:");
  });

  it("should serialize quads with URI objects", async () => {
    const store = new GraphStore();
    store.addQuad(buttonUri, PREDICATES.type, componentType);
    store.addQuad(buttonUri, PREDICATES.tier, globalUri);

    const prefixes = createPrefixMap();
    const ttl = await serializeToTurtle(store, { prefixes });

    expect(ttl).toContain("ds:button");
    // n3 uses 'a' shorthand for rdf:type in Turtle
    expect(ttl).toMatch(/a |rdf:type/);
    expect(ttl).toContain("ds:Component");
  });

  it("should serialize quads with literal objects", async () => {
    const store = new GraphStore();
    store.addLiteral(buttonUri, PREDICATES.name, "Button");

    const prefixes = createPrefixMap();
    const ttl = await serializeToTurtle(store, { prefixes });

    expect(ttl).toContain('"Button"');
  });

  it("should group statements by subject with semicolons", async () => {
    const store = new GraphStore();
    store.addQuad(buttonUri, PREDICATES.type, componentType);
    store.addLiteral(buttonUri, PREDICATES.name, "Button");

    const prefixes = createPrefixMap();
    const ttl = await serializeToTurtle(store, { prefixes });

    // n3 Writer groups by subject and uses semicolons
    expect(ttl).toContain(";");
  });
});

describe("serializeToTurtle: literals survive inlining", () => {
  /**
   * The real text that corrupted `apps_landscape/component/tag_multi_select`.
   *
   * It documents a Yup validation schema, so it quotes a regular expression
   * ending in `$` immediately followed by a backtick. In a
   * `String.prototype.replace` *replacement string* the two characters
   * ``$` `` mean "everything in the subject before the match", so the whole
   * preceding document — starting with the `@prefix` declarations — was
   * spliced into the middle of this literal, leaving it unterminated and the
   * file unparseable.
   */
  const CONSTRAINTS =
    "TypeScript: `string[]`. Source does not deduplicate. Internal Yup " +
    "`validationSchema` requires `^[a-zA-Z]`, then " +
    "`^[a-zA-Z][a-zA-Z0-9_-]*$`. Its first error is `Tag must starts with " +
    "a letter`.";

  /** Serialize one component carrying one inlined property blank node. */
  async function serializeWithProperty(constraints: string): Promise<string> {
    const store = new GraphStore();
    const prefixes = createPrefixMap();
    store.addQuad(buttonUri, PREDICATES.type, componentType);

    const bn = store.createBlankNode();
    store.addBlankNodeQuad(buttonUri, `${NAMESPACES.ds}hasProperty`, bn);
    store.addQuadFromBlankNode(bn, PREDICATES.type, `${NAMESPACES.ds}Property`);
    store.addLiteralFromBlankNode(bn, `${NAMESPACES.ds}name`, "tags");
    store.addLiteralFromBlankNode(
      bn,
      `${NAMESPACES.ds}constraints`,
      constraints,
    );

    return serializeToTurtle(store, { prefixes });
  }

  it("keeps a literal containing $-sequences verbatim", async () => {
    const ttl = await serializeWithProperty(CONSTRAINTS);

    // The literal is present exactly once, unaltered and undamaged.
    expect(ttl).toContain('ds:constraints "');
    expect(ttl).toContain("^[a-zA-Z][a-zA-Z0-9_-]*$");
    expect(ttl).toContain("Tag must starts with a letter");
  });

  it("does not splice the document into a literal", async () => {
    const ttl = await serializeWithProperty(CONSTRAINTS);

    // The precise corruption: a prefix declaration appearing INSIDE the
    // property block rather than only at the top of the file.
    const declarations = ttl.match(/@prefix ds:/g) ?? [];
    expect(declarations).toHaveLength(1);
    expect(ttl.indexOf("@prefix ds:")).toBe(ttl.lastIndexOf("@prefix ds:"));
  });

  it("emits a balanced, terminated blank node", async () => {
    const ttl = await serializeWithProperty(CONSTRAINTS);

    // Unbalanced brackets are how the unparseable file presented: an inline
    // property block that opened and never closed.
    const opens = (ttl.match(/\[/g) ?? []).length;
    const closes = (ttl.match(/\]/g) ?? []).length;
    expect(opens).toBe(closes);
    // No standalone blank-node definition should survive inlining.
    expect(ttl).not.toMatch(/^_:/m);
  });

  it("round-trips through a parser", async () => {
    // The end-to-end property that actually matters: whatever we write, a
    // consumer can read. `pragma sources update` refused the whole pack over
    // this one file.
    const { Parser } = await import("n3");
    const ttl = await serializeWithProperty(CONSTRAINTS);

    const quads = new Parser().parse(ttl);

    expect(quads.length).toBeGreaterThan(0);
    const literals = quads
      .filter((q) => q.object.termType === "Literal")
      .map((q) => q.object.value);
    expect(literals).toContain(CONSTRAINTS);
  });

  it("round-trips every replacement-pattern sequence", async () => {
    // `$&`, `$'`, `` $` `` and `$1` are all special in a replacement string.
    // Documented data really does contain them (regexes, shell snippets,
    // jQuery), so each is pinned rather than only the one that bit us.
    const { Parser } = await import("n3");
    const nasty = "patterns: $& and $' and $` and $1 and $$ and $<n>";

    const ttl = await serializeWithProperty(nasty);
    const quads = new Parser().parse(ttl);

    const literals = quads
      .filter((q) => q.object.termType === "Literal")
      .map((q) => q.object.value);
    expect(literals).toContain(nasty);
  });
});

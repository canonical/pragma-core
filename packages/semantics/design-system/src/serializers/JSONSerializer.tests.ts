import { describe, expect, it } from "vitest";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore, PrefixMap } from "../graph/index.js";
import serializeToJsonLd from "./JSONSerializer.js";

// Use realistic dot-separated URIs like the actual system
const buttonUri = `${NAMESPACES.ds}global.component.button`;
const inputUri = `${NAMESPACES.ds}global.component.input`;
const componentType = `${NAMESPACES.ds}Component`;

describe("serializeToJsonLd", () => {
  it("should serialize a single subject to JSON-LD with compact URIs", async () => {
    const store = new GraphStore();
    store.addQuad(buttonUri, PREDICATES.type, componentType);
    store.addLiteral(buttonUri, PREDICATES.name, "Button");

    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const doc = await serializeToJsonLd(store, {
      prefixes,
      subject: buttonUri,
    });

    // JSON-LD compact uses prefixed URIs
    expect(doc["@id"]).toBe("ds:global.component.button");
    // @type can be a string or array in JSON-LD
    const type = doc["@type"];
    expect(Array.isArray(type) ? type[0] : type).toBe("ds:Component");
  });

  it("should include context from prefixes", async () => {
    const store = new GraphStore();
    store.addLiteral(buttonUri, PREDICATES.name, "Button");

    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const doc = await serializeToJsonLd(store, {
      prefixes,
      subject: buttonUri,
    });

    expect(doc["@context"]).toBeDefined();
    expect((doc["@context"] as Record<string, string>).ds).toBe(NAMESPACES.ds);
  });

  it("should return empty object for unknown subject", async () => {
    const store = new GraphStore();
    store.addLiteral(buttonUri, PREDICATES.name, "Button");

    const prefixes = new PrefixMap();
    const unknownUri = `${NAMESPACES.ds}global.component.unknown`;

    const doc = await serializeToJsonLd(store, {
      prefixes,
      subject: unknownUri,
    });

    // Unknown subject returns full URI since no data to compact
    expect(doc["@id"]).toBe(unknownUri);
  });

  it("should serialize all subjects when no subject specified", async () => {
    const store = new GraphStore();
    store.addLiteral(buttonUri, PREDICATES.name, "Button");
    store.addLiteral(inputUri, PREDICATES.name, "Input");

    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const docs = await serializeToJsonLd(store, { prefixes });

    expect(Array.isArray(docs) || docs["@graph"]).toBeTruthy();
  });
});

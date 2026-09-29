import { describe, expect, it } from "vitest";
import GraphStore from "./GraphStore.js";

describe("GraphStore", () => {
  describe("addQuad", () => {
    it("should add a quad with URI object", () => {
      const store = new GraphStore();

      store.addQuad("ds:button", "rdf:type", "ds:Component");

      expect(store.size()).toBe(1);
    });

    it("should add a quad with literal object", () => {
      const store = new GraphStore();

      store.addLiteral("ds:button", "ds:name", "Button");

      expect(store.size()).toBe(1);
    });

    it("should add multiple quads", () => {
      const store = new GraphStore();

      store.addQuad("ds:button", "rdf:type", "ds:Component");
      store.addLiteral("ds:button", "ds:name", "Button");
      store.addQuad("ds:button", "ds:tier", "ds:global");

      expect(store.size()).toBe(3);
    });
  });

  describe("getQuads", () => {
    it("should return all quads", () => {
      const store = new GraphStore();
      store.addQuad("ds:button", "rdf:type", "ds:Component");
      store.addLiteral("ds:button", "ds:name", "Button");

      const quads = store.getQuads();

      expect(quads).toHaveLength(2);
    });

    it("should return empty array for empty store", () => {
      const store = new GraphStore();

      const quads = store.getQuads();

      expect(quads).toHaveLength(0);
    });
  });

  describe("getQuadsForSubject", () => {
    it("should return quads for a specific subject", () => {
      const store = new GraphStore();
      store.addQuad("ds:button", "rdf:type", "ds:Component");
      store.addLiteral("ds:button", "ds:name", "Button");
      store.addQuad("ds:input", "rdf:type", "ds:Component");

      const quads = store.getQuadsForSubject("ds:button");

      expect(quads).toHaveLength(2);
    });

    it("should return empty array for unknown subject", () => {
      const store = new GraphStore();
      store.addQuad("ds:button", "rdf:type", "ds:Component");

      const quads = store.getQuadsForSubject("ds:unknown");

      expect(quads).toHaveLength(0);
    });
  });

  describe("getSubjects", () => {
    it("should return unique subjects", () => {
      const store = new GraphStore();
      store.addQuad("ds:button", "rdf:type", "ds:Component");
      store.addLiteral("ds:button", "ds:name", "Button");
      store.addQuad("ds:input", "rdf:type", "ds:Component");

      const subjects = store.getSubjects();

      expect(subjects).toHaveLength(2);
      expect(subjects).toContain("ds:button");
      expect(subjects).toContain("ds:input");
    });
  });

  describe("getN3Store", () => {
    it("should return underlying n3 store for serializers", () => {
      const store = new GraphStore();
      store.addQuad("ds:button", "rdf:type", "ds:Component");

      const n3Store = store.getN3Store();

      expect(n3Store).toBeDefined();
      expect(n3Store.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all quads", () => {
      const store = new GraphStore();
      store.addQuad("ds:button", "rdf:type", "ds:Component");
      store.addLiteral("ds:button", "ds:name", "Button");

      store.clear();

      expect(store.size()).toBe(0);
    });
  });

  describe("blank nodes", () => {
    it("should create a blank node", () => {
      const store = new GraphStore();

      const bn = store.createBlankNode();

      expect(bn).toBeDefined();
      expect(bn.termType).toBe("BlankNode");
    });

    it("should add a quad with blank node as object", () => {
      const store = new GraphStore();
      const bn = store.createBlankNode();

      store.addBlankNodeQuad("ds:button", "ds:hasProperty", bn);

      expect(store.size()).toBe(1);
      const quads = store.getQuads();
      expect(quads[0].object.termType).toBe("BlankNode");
    });

    it("should add quads from blank node subject", () => {
      const store = new GraphStore();
      const bn = store.createBlankNode();

      store.addBlankNodeQuad("ds:button", "ds:hasProperty", bn);
      store.addLiteralFromBlankNode(bn, "ds:name", "content");
      store.addQuadFromBlankNode(bn, "rdf:type", "ds:Property");

      expect(store.size()).toBe(3);
    });

    it("should serialize inline blank nodes in turtle", async () => {
      const store = new GraphStore();
      const bn = store.createBlankNode();

      store.addBlankNodeQuad("ds:button", "ds:hasProperty", bn);
      store.addLiteralFromBlankNode(bn, "ds:name", "content");

      const quads = store.getQuads();
      expect(quads).toHaveLength(2);
    });
  });
});

import { describe, expect, it } from "vitest";
import buildUri from "./buildUri.js";

describe("buildUri", () => {
  describe("template interpolation", () => {
    it("should interpolate simple template values", () => {
      const template = "ds:component:{name}:{version}";
      const row = { name: "button", version: "1.0.0" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:component:button:1.0.0");
    });

    it("should handle multiple placeholders", () => {
      const template = "ds:{tier}:{type}:{name}";
      const row = { tier: "global", type: "component", name: "button" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:global:component:button");
    });
  });

  describe("URI-safe conversion", () => {
    it("should preserve case for ds: prefix (ontology prefix)", () => {
      const template = "ds:{name}";
      const row = { name: "Button" };

      const uri = buildUri(template, row);

      // ds: is treated as an ontology prefix, preserves case
      expect(uri).toBe("ds:Button");
    });

    it("should replace spaces with hyphens for ds: prefix", () => {
      const template = "ds:{name}";
      const row = { name: "My Button" };

      const uri = buildUri(template, row);

      // ds: is an ontology prefix, preserves case but replaces spaces
      expect(uri).toBe("ds:My-Button");
    });

    it("should preserve dots for versions", () => {
      const template = "ds:{version}";
      const row = { version: "1.0.0" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:1.0.0");
    });

    it("should remove special characters but preserve case for ds:", () => {
      const template = "ds:{name}";
      const row = { name: "Button (Primary)" };

      const uri = buildUri(template, row);

      // ds: is an ontology prefix, preserves case
      expect(uri).toBe("ds:Button-Primary");
    });

    it("should lowercase for non-ontology prefixes", () => {
      const template = "ex:{name}";
      const row = { name: "Button" };

      const uri = buildUri(template, row);

      // ex: is not an ontology prefix, lowercases values
      expect(uri).toBe("ex:button");
    });
  });

  describe("single column template", () => {
    it("should return raw value for single column reference", () => {
      const template = "{uri}";
      const row = { uri: "ds:global:component:button" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:global:component:button");
    });

    it("should not transform single column value", () => {
      const template = "{uri}";
      const row = { uri: "ds:Global:Component:Button" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:Global:Component:Button");
    });
  });

  describe("missing values", () => {
    it("should handle missing template values gracefully", () => {
      const template = "ds:component:{name}:{version}";
      const row = { name: "button" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:component:button:");
    });

    it("should return empty string for null value in single column", () => {
      const template = "{uri}";
      const row = { uri: null };

      const uri = buildUri(template, row);

      expect(uri).toBe("");
    });

    it("should return empty string for undefined value in single column", () => {
      const template = "{uri}";
      const row = {};

      const uri = buildUri(template, row);

      expect(uri).toBe("");
    });
  });

  describe("ontology namespace templates", () => {
    it("should preserve case for ds: prefix", () => {
      const template = "ds:{Name}";
      const row = { Name: "Component" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:Component");
    });

    it("should preserve case for rdf: prefix", () => {
      const template = "rdf:{Type}";
      const row = { Type: "Property" };

      const uri = buildUri(template, row);

      expect(uri).toBe("rdf:Property");
    });

    it("should preserve case for rdfs: prefix", () => {
      const template = "rdfs:{Class}";
      const row = { Class: "Resource" };

      const uri = buildUri(template, row);

      expect(uri).toBe("rdfs:Resource");
    });

    it("should still replace spaces with hyphens in ontology URIs", () => {
      const template = "ds:{Name}";
      const row = { Name: "My Component" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:My-Component");
    });

    it("should remove special characters in ontology URIs", () => {
      const template = "ds:{Name}";
      const row = { Name: "Component (Type)" };

      const uri = buildUri(template, row);

      expect(uri).toBe("ds:Component-Type");
    });
  });
});

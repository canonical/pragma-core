import { describe, expect, it } from "vitest";
import { NAMESPACES } from "../constants.js";
import PrefixMap from "./PrefixMap.js";

describe("PrefixMap", () => {
  describe("add and get", () => {
    it("should store and retrieve a prefix", () => {
      const pm = new PrefixMap();
      pm.add("ds", NAMESPACES.ds);

      expect(pm.get("ds")).toBe(NAMESPACES.ds);
    });

    it("should return undefined for unknown prefix", () => {
      const pm = new PrefixMap();

      expect(pm.get("unknown")).toBeUndefined();
    });
  });

  describe("expand", () => {
    it("should expand prefixed URI to full URI", () => {
      const pm = new PrefixMap();
      pm.add("ds", NAMESPACES.ds);

      expect(pm.expand("ds:name")).toBe(`${NAMESPACES.ds}name`);
    });

    it("should return original if no colon", () => {
      const pm = new PrefixMap();

      expect(pm.expand("name")).toBe("name");
    });

    it("should return original if prefix not found", () => {
      const pm = new PrefixMap();

      expect(pm.expand("unknown:name")).toBe("unknown:name");
    });

    it("should preserve slashes in local name", () => {
      const pm = new PrefixMap();
      pm.add("ds", NAMESPACES.ds);

      expect(pm.expand("ds:global/component/button")).toBe(
        `${NAMESPACES.ds}global/component/button`,
      );
    });
  });

  describe("compact", () => {
    it("should compact full URI to prefixed form", () => {
      const pm = new PrefixMap();
      pm.add("ds", NAMESPACES.ds);

      expect(pm.compact(`${NAMESPACES.ds}name`)).toBe("ds:name");
    });

    it("should return original if no matching prefix", () => {
      const pm = new PrefixMap();

      expect(pm.compact("https://example.com/name")).toBe(
        "https://example.com/name",
      );
    });

    it("should use longest matching prefix", () => {
      const pm = new PrefixMap();
      pm.add("ex", "https://example.com/");
      pm.add("exo", "https://example.com/ontology#");

      expect(pm.compact("https://example.com/ontology#name")).toBe("exo:name");
    });
  });

  describe("fromContext", () => {
    it("should extract prefixes from JSON-LD context", () => {
      const context = {
        ds: NAMESPACES.ds,
        rdf: NAMESPACES.rdf,
        name: "ds:name",
      };

      const pm = PrefixMap.fromContext(context);

      expect(pm.get("ds")).toBe(NAMESPACES.ds);
      expect(pm.get("rdf")).toBe(NAMESPACES.rdf);
      expect(pm.get("name")).toBeUndefined(); // Not a namespace
    });

    it("should ignore non-URI values", () => {
      const context = {
        ds: NAMESPACES.ds,
        name: { "@id": "ds:name" },
      };

      const pm = PrefixMap.fromContext(context);

      expect(pm.get("ds")).toBe(NAMESPACES.ds);
      expect(pm.get("name")).toBeUndefined();
    });
  });

  describe("entries", () => {
    it("should iterate over all prefixes", () => {
      const pm = new PrefixMap();
      pm.add("ds", NAMESPACES.ds);
      pm.add("rdf", NAMESPACES.rdf);

      const entries = Array.from(pm.entries());

      expect(entries).toContainEqual(["ds", NAMESPACES.ds]);
      expect(entries).toContainEqual(["rdf", NAMESPACES.rdf]);
    });
  });

  describe("toRecord", () => {
    it("should convert to plain object for n3", () => {
      const pm = new PrefixMap();
      pm.add("ds", NAMESPACES.ds);
      pm.add("rdf", NAMESPACES.rdf);

      const record = pm.toRecord();

      expect(record).toEqual({
        ds: NAMESPACES.ds,
        rdf: NAMESPACES.rdf,
      });
    });
  });
});

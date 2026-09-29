import { describe, expect, it } from "vitest";
import { NAMESPACES, PREDICATES } from "../constants.js";
import { GraphStore, PrefixMap } from "../graph/index.js";
import transformRow from "./transformRow.js";
import type { ReferenceMap } from "./types.js";

const buttonUri = `${NAMESPACES.ds}global:component:button`;
const globalUri = `${NAMESPACES.ds}global`;
const componentType = `${NAMESPACES.ds}Component`;

describe("transformRow", () => {
  it("should add type quad from class config", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = { name: "Button", uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    transformRow(row, config, store, prefixes, new Map());

    const quads = store.getQuads();
    const typeQuad = quads.find((q) => q.predicate.value === PREDICATES.type);
    expect(typeQuad).toBeDefined();
    expect(typeQuad?.object.value).toBe(componentType);
  });

  it("should add literal properties", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = {
      name: "Button",
      description: "A clickable button",
      uri: buttonUri,
    };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
        description: "ds:summary",
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    transformRow(row, config, store, prefixes, new Map());

    const quads = store.getQuads();
    const nameQuad = quads.find((q) => q.predicate.value === PREDICATES.name);
    expect(nameQuad?.object.value).toBe("Button");
  });

  it("should resolve reference properties to URIs", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const refMap: ReferenceMap = new Map([["global", globalUri]]);

    const row = { name: "Button", tier: "Global", uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
        tier: { "@id": "ds:tier", "@type": "@id" },
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    transformRow(row, config, store, prefixes, refMap);

    const quads = store.getQuads();
    const tierQuad = quads.find((q) => q.predicate.value === PREDICATES.tier);
    expect(tierQuad?.object.value).toBe(globalUri);
  });

  it("should skip null/undefined values", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = { name: "Button", description: null, uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
        description: "ds:summary",
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    transformRow(row, config, store, prefixes, new Map());

    const quads = store.getQuads();
    const descQuad = quads.find(
      (q) => q.predicate.value === PREDICATES.summary,
    );
    expect(descQuad).toBeUndefined();
  });

  it("should add empty string literals", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = { name: "Button", description: "", uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
        description: "ds:summary",
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    transformRow(row, config, store, prefixes, new Map());

    const quads = store.getQuads();
    const descQuad = quads.find(
      (q) => q.predicate.value === PREDICATES.summary,
    );
    expect(descQuad).toBeDefined();
    expect(descQuad?.object.value).toBe("");
  });

  it("should handle dynamic class from row data", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const refMap: ReferenceMap = new Map([["component", componentType]]);

    const row = { name: "Button", type: "Component", uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
      },
      class: "{type}",
      uriTemplate: "{uri}",
    };

    transformRow(row, config, store, prefixes, refMap);

    const quads = store.getQuads();
    const typeQuad = quads.find((q) => q.predicate.value === PREDICATES.type);
    expect(typeQuad?.object.value).toBe(componentType);
  });

  it("should return the subject URI", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = { name: "Button", uri: buttonUri };
    const config = {
      "@context": { ds: NAMESPACES.ds, name: "ds:name" },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    const subjectUri = transformRow(row, config, store, prefixes, new Map());

    expect(subjectUri).toBe(buttonUri);
  });

  it("should embed inline properties as blank nodes", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = { name: "Button", properties: "prop-1,prop-2", uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
        properties: {
          "@id": "ds:hasProperty",
          "@inline": {
            table: "properties",
            class: "ds:Property",
            properties: {
              name: "ds:propertyName",
              type: "ds:propertyType",
            },
          },
        },
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    const inlineData = {
      properties: new Map([
        ["prop-1", { _codaId: "prop-1", name: "content", type: "string" }],
        ["prop-2", { _codaId: "prop-2", name: "variant", type: "enum" }],
      ]),
    };

    transformRow(row, config, store, prefixes, new Map(), inlineData);

    const quads = store.getQuads();

    // Should have: 1 type quad + 1 name quad + 2 blank node links + 2x3 blank node properties
    expect(quads.length).toBeGreaterThanOrEqual(8);

    // Find blank node quads
    const hasPropertyQuads = quads.filter(
      (q) => q.predicate.value === `${NAMESPACES.ds}hasProperty`,
    );
    expect(hasPropertyQuads).toHaveLength(2);

    // Blank nodes should have the right type
    const blankNodeTypes = quads.filter(
      (q) =>
        q.subject.termType === "BlankNode" &&
        q.predicate.value === PREDICATES.type,
    );
    expect(blankNodeTypes).toHaveLength(2);
    expect(blankNodeTypes[0].object.value).toBe(`${NAMESPACES.ds}Property`);
  });

  describe("rich value objects", () => {
    it("resolves class from a {type} template when type is a Coda reference object", () => {
      const store = new GraphStore();
      const prefixes = new PrefixMap();
      prefixes.add("ds", NAMESPACES.ds);
      // type arrives as a rich lookup object; refMap resolves it by id.
      const refMap: ReferenceMap = new Map([["i-type-1", componentType]]);

      const row = {
        name: "Button",
        uri: buttonUri,
        type: { id: "i-type-1", name: "Component" },
      };
      const config = {
        "@context": { ds: NAMESPACES.ds, name: "ds:name" },
        class: "{type}",
        uriTemplate: "{uri}",
      };

      const subject = transformRow(row, config, store, prefixes, refMap);

      expect(subject).not.toBeNull();
      const typeQuad = store
        .getQuads()
        .find((q) => q.predicate.value === PREDICATES.type);
      expect(typeQuad?.object.value).toBe(componentType);
    });

    it("emits a literal's display name, not [object Object], for a lookup-shaped value", () => {
      const store = new GraphStore();
      const prefixes = new PrefixMap();
      prefixes.add("ds", NAMESPACES.ds);

      const row = {
        name: "Button",
        uri: buttonUri,
        category: { id: "i-cat-1", name: "documentation stage" },
      };
      const config = {
        "@context": { ds: NAMESPACES.ds, category: "ds:category" },
        class: "ds:Component",
        uriTemplate: "{uri}",
      };

      transformRow(row, config, store, prefixes, new Map());

      const catQuad = store
        .getQuads()
        .find((q) => q.predicate.value === `${NAMESPACES.ds}category`);
      expect(catQuad?.object.value).toBe("documentation stage");
    });

    it("emits a link value's url for a webpage-shaped value", () => {
      const store = new GraphStore();
      const prefixes = new PrefixMap();
      prefixes.add("ds", NAMESPACES.ds);

      const row = {
        name: "Button",
        uri: buttonUri,
        link: {
          "@type": "WebPage",
          url: "https://github.com/canonical/x/pull/1",
        },
      };
      const config = {
        "@context": { ds: NAMESPACES.ds, link: "ds:githubLink" },
        class: "ds:Component",
        uriTemplate: "{uri}",
      };

      transformRow(row, config, store, prefixes, new Map());

      const linkQuad = store
        .getQuads()
        .find((q) => q.predicate.value === `${NAMESPACES.ds}githubLink`);
      expect(linkQuad?.object.value).toBe(
        "https://github.com/canonical/x/pull/1",
      );
    });
  });

  describe("classProperties", () => {
    const layoutUri = `${NAMESPACES.ds}global.layout.app`;

    it("should apply classProperties when the resolved class matches", () => {
      const store = new GraphStore();
      const prefixes = new PrefixMap();
      prefixes.add("ds", NAMESPACES.ds);

      const row = {
        name: "App Layout",
        layout_grid_template: "1fr min-content;",
        layout_information_domain: "application",
        uri: layoutUri,
      };
      const config = {
        "@context": { ds: NAMESPACES.ds, name: "ds:name" },
        class: "ds:Layout",
        uriTemplate: "{uri}",
        classProperties: {
          "ds:Layout": {
            layout_grid_template: "ds:grid",
            layout_information_domain: "ds:domain",
          },
        },
      };

      transformRow(row, config, store, prefixes, new Map());

      const quads = store.getQuads();
      const gridQuad = quads.find(
        (q) => q.predicate.value === `${NAMESPACES.ds}grid`,
      );
      const domainQuad = quads.find(
        (q) => q.predicate.value === `${NAMESPACES.ds}domain`,
      );

      expect(gridQuad?.object.value).toBe("1fr min-content;");
      expect(domainQuad?.object.value).toBe("application");
    });

    it("should NOT apply classProperties when the resolved class does not match", () => {
      const store = new GraphStore();
      const prefixes = new PrefixMap();
      prefixes.add("ds", NAMESPACES.ds);

      const row = {
        name: "Button",
        layout_grid_template: "1fr;",
        layout_information_domain: "view",
        uri: buttonUri,
      };
      const config = {
        "@context": { ds: NAMESPACES.ds, name: "ds:name" },
        class: "ds:Component",
        uriTemplate: "{uri}",
        classProperties: {
          "ds:Layout": {
            layout_grid_template: "ds:grid",
            layout_information_domain: "ds:domain",
          },
        },
      };

      transformRow(row, config, store, prefixes, new Map());

      const quads = store.getQuads();
      const gridQuad = quads.find(
        (q) => q.predicate.value === `${NAMESPACES.ds}grid`,
      );
      const domainQuad = quads.find(
        (q) => q.predicate.value === `${NAMESPACES.ds}domain`,
      );

      expect(gridQuad).toBeUndefined();
      expect(domainQuad).toBeUndefined();
    });

    it("should skip empty classProperty values", () => {
      const store = new GraphStore();
      const prefixes = new PrefixMap();
      prefixes.add("ds", NAMESPACES.ds);

      const row = {
        name: "App Layout",
        layout_grid_template: "",
        layout_information_domain: null,
        uri: layoutUri,
      };
      const config = {
        "@context": { ds: NAMESPACES.ds, name: "ds:name" },
        class: "ds:Layout",
        uriTemplate: "{uri}",
        classProperties: {
          "ds:Layout": {
            layout_grid_template: "ds:grid",
            layout_information_domain: "ds:domain",
          },
        },
      };

      transformRow(row, config, store, prefixes, new Map());

      const quads = store.getQuads();
      const gridQuad = quads.find(
        (q) => q.predicate.value === `${NAMESPACES.ds}grid`,
      );
      const domainQuad = quads.find(
        (q) => q.predicate.value === `${NAMESPACES.ds}domain`,
      );

      expect(gridQuad).toBeUndefined();
      expect(domainQuad).toBeUndefined();
    });
  });

  it("should skip inline properties when no matching data", () => {
    const store = new GraphStore();
    const prefixes = new PrefixMap();
    prefixes.add("ds", NAMESPACES.ds);

    const row = { name: "Button", properties: "unknown-id", uri: buttonUri };
    const config = {
      "@context": {
        ds: NAMESPACES.ds,
        name: "ds:name",
        properties: {
          "@id": "ds:hasProperty",
          "@inline": {
            table: "properties",
            properties: { name: "ds:propertyName" },
          },
        },
      },
      class: "ds:Component",
      uriTemplate: "{uri}",
    };

    const inlineData = {
      properties: new Map<string, Record<string, unknown>>(),
    };

    transformRow(row, config, store, prefixes, new Map(), inlineData);

    const quads = store.getQuads();
    const hasPropertyQuads = quads.filter(
      (q) => q.predicate.value === `${NAMESPACES.ds}hasProperty`,
    );
    expect(hasPropertyQuads).toHaveLength(0);
  });
});

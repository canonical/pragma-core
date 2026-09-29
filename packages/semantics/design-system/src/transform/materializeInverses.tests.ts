import { describe, expect, it } from "vitest";
import { NAMESPACES } from "../constants.js";
import { GraphStore } from "../graph/index.js";
import materializeInverses, {
  parseInversePairs,
} from "./materializeInverses.js";

const ds = NAMESPACES.ds;
const ONTOLOGY = `
@prefix ds: <${ds}> .
@prefix owl: <${NAMESPACES.owl}> .
ds:hasSubcomponent a owl:ObjectProperty ; owl:inverseOf ds:parentComponent .
ds:inheritsFrom a owl:ObjectProperty ; owl:inverseOf ds:specializedBy .
`;

describe("parseInversePairs", () => {
  it("returns both directions for each owl:inverseOf pair", () => {
    const pairs = parseInversePairs(ONTOLOGY);

    expect(pairs.get(`${ds}hasSubcomponent`)).toBe(`${ds}parentComponent`);
    expect(pairs.get(`${ds}parentComponent`)).toBe(`${ds}hasSubcomponent`);
    expect(pairs.get(`${ds}inheritsFrom`)).toBe(`${ds}specializedBy`);
    expect(pairs.get(`${ds}specializedBy`)).toBe(`${ds}inheritsFrom`);
  });

  it("returns an empty map when no inverses are declared", () => {
    expect(parseInversePairs("@prefix ds: <x> .").size).toBe(0);
  });
});

describe("materializeInverses", () => {
  it("adds the reverse triple for a forward inverse-property", () => {
    const store = new GraphStore();
    store.addQuad(
      `${ds}global.component.accordion`,
      `${ds}hasSubcomponent`,
      `${ds}global.subcomponent.accordion-item`,
    );

    const added = materializeInverses(store, ONTOLOGY);

    expect(added).toBe(1);
    const reverse = store
      .getQuadsForSubject(`${ds}global.subcomponent.accordion-item`)
      .find((q) => q.predicate.value === `${ds}parentComponent`);
    expect(reverse?.object.value).toBe(`${ds}global.component.accordion`);
  });

  it("materializes inheritsFrom -> specializedBy", () => {
    const store = new GraphStore();
    store.addQuad(
      `${ds}global.component.datatooltip`,
      `${ds}inheritsFrom`,
      `${ds}global.component.tooltip`,
    );

    materializeInverses(store, ONTOLOGY);

    const reverse = store
      .getQuadsForSubject(`${ds}global.component.tooltip`)
      .find((q) => q.predicate.value === `${ds}specializedBy`);
    expect(reverse?.object.value).toBe(`${ds}global.component.datatooltip`);
  });

  it("does not duplicate an already-present reverse triple", () => {
    const store = new GraphStore();
    store.addQuad(`${ds}a`, `${ds}hasSubcomponent`, `${ds}b`);
    store.addQuad(`${ds}b`, `${ds}parentComponent`, `${ds}a`);

    const added = materializeInverses(store, ONTOLOGY);

    expect(added).toBe(0);
  });

  it("ignores predicates without a declared inverse", () => {
    const store = new GraphStore();
    store.addQuad(`${ds}a`, `${ds}name`, `${ds}b`);

    expect(materializeInverses(store, ONTOLOGY)).toBe(0);
  });
});

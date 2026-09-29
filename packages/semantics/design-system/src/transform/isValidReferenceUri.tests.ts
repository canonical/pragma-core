import { describe, expect, it } from "vitest";
import isValidReferenceUri, { dsLocalName } from "./isValidReferenceUri.js";

describe("isValidReferenceUri", () => {
  it("accepts well-formed ds references (prefixed and full)", () => {
    expect(isValidReferenceUri("ds:global.component.card")).toBe(true);
    expect(isValidReferenceUri("ds:global.subcomponent.card-footer")).toBe(
      true,
    );
    expect(
      isValidReferenceUri("https://ds.canonical.com/global.subcomponent.x"),
    ).toBe(true);
    expect(isValidReferenceUri("ds:tag.needsdocumentation")).toBe(true);
  });

  it("rejects the degenerate IRIs that break TTL parsing", () => {
    // These are the exact shapes shipped in the broken design-system data.
    expect(isValidReferenceUri("ds:global..")).toBe(false);
    expect(isValidReferenceUri("ds:global...")).toBe(false);
    expect(isValidReferenceUri("ds:.subcomponent.accordion-item")).toBe(false);
    expect(isValidReferenceUri("ds:apps_launchpad...")).toBe(false);
    expect(isValidReferenceUri("ds:apps...")).toBe(false);
    expect(isValidReferenceUri("https://ds.canonical.com/global..")).toBe(
      false,
    );
  });

  it("rejects an empty ds local name", () => {
    expect(isValidReferenceUri("ds:")).toBe(false);
  });

  it("does not judge non-ds values", () => {
    expect(isValidReferenceUri("http://example.com/thing")).toBe(true);
    expect(isValidReferenceUri("rdf:type")).toBe(true);
    expect(isValidReferenceUri("")).toBe(true);
  });

  it("dsLocalName extracts the local part or null", () => {
    expect(dsLocalName("ds:global.component.card")).toBe(
      "global.component.card",
    );
    expect(dsLocalName("https://ds.canonical.com/global..")).toBe("global..");
    expect(dsLocalName("rdf:type")).toBeNull();
  });
});

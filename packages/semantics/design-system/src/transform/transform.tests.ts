import { describe, expect, it, vi } from "vitest";
import { NAMESPACES, PREDICATES } from "../constants.js";
import transform from "./transform.js";

describe("transform", () => {
  const extractedData = {
    document: "test-doc",
    extractedAt: "2024-01-01",
    tables: {
      uiBlocks: [
        {
          _codaId: "i-1",
          name: "Button",
          tier: "Global",
          type: "Component",
          uri: `${NAMESPACES.ds}global:component:button`,
        },
        {
          _codaId: "i-2",
          name: "Input",
          tier: "Global",
          type: "Component",
          uri: `${NAMESPACES.ds}global:component:input`,
        },
      ],
      tiers: [
        { _codaId: "i-tier-1", name: "Global", uri: `${NAMESPACES.ds}global` },
      ],
      uiBlockTypes: [{ _codaId: "i-type-1", Name: "Component" }],
    },
  };

  const config = {
    format: "json-ld" as const,
    outputDir: "instances/",
    atomicity: "instance" as const,
    tables: {
      uiBlocks: {
        "@context": {
          ds: NAMESPACES.ds,
          name: "ds:name",
          tier: { "@id": "ds:tier", "@type": "@id" },
        },
        class: "{type}",
        uriTemplate: "{uri}",
      },
    },
    references: {
      tiers: { uriTemplate: "{uri}", keyColumn: "name" },
      uiBlockTypes: {
        uriTemplate: `${NAMESPACES.ds}{Name}`,
        keyColumn: "Name",
      },
    },
  };

  it("should transform extracted data into a graph store", () => {
    const { store, subjects } = transform(config, extractedData);

    expect(store.size()).toBeGreaterThan(0);
    expect(subjects).toHaveLength(2);
  });

  it("should create quads for each row", () => {
    const { store } = transform(config, extractedData);

    const buttonQuads = store.getQuadsForSubject(
      `${NAMESPACES.ds}global:component:button`,
    );
    expect(buttonQuads.length).toBeGreaterThan(0);

    const inputQuads = store.getQuadsForSubject(
      `${NAMESPACES.ds}global:component:input`,
    );
    expect(inputQuads.length).toBeGreaterThan(0);
  });

  it("should resolve reference values", () => {
    const { store } = transform(config, extractedData);

    const buttonQuads = store.getQuadsForSubject(
      `${NAMESPACES.ds}global:component:button`,
    );
    const tierQuad = buttonQuads.find(
      (q) => q.predicate.value === PREDICATES.tier,
    );

    expect(tierQuad?.object.value).toBe(`${NAMESPACES.ds}global`);
  });

  it("should resolve dynamic class from reference", () => {
    const { store } = transform(config, extractedData);

    const buttonQuads = store.getQuadsForSubject(
      `${NAMESPACES.ds}global:component:button`,
    );
    const typeQuad = buttonQuads.find(
      (q) => q.predicate.value === PREDICATES.type,
    );

    // buildUri preserves case for ds: prefix (ontology template)
    expect(typeQuad?.object.value).toBe(`${NAMESPACES.ds}Component`);
  });

  it("should return prefixes from context", () => {
    const { prefixes } = transform(config, extractedData);

    expect(prefixes.get("ds")).toBe(NAMESPACES.ds);
  });

  it("should report per-table row and subject counts", () => {
    const { tableStats } = transform(config, extractedData);

    expect(tableStats).toEqual({
      uiBlocks: { rows: 2, filtered: 0, eligible: 2, subjects: 2 },
    });
  });

  it("reports no malformed rows for a healthy extract", () => {
    const { malformedRows } = transform(config, extractedData);

    expect(malformedRows).toEqual([]);
  });

  it("reports a row whose uri is present but degenerate, with its table", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const withMalformed = {
      ...extractedData,
      tables: {
        ...extractedData.tables,
        uiBlocks: [
          ...extractedData.tables.uiBlocks,
          // A blank upstream reference leaves empty dot segments.
          {
            _codaId: "i-3",
            name: "",
            tier: "Global",
            type: "Component",
            uri: "ds:global..",
          },
        ],
      },
    };

    const { malformedRows, subjects } = transform(config, withMalformed);

    expect(malformedRows).toEqual([{ table: "uiBlocks", uri: "ds:global.." }]);
    // The row is still dropped — the guard's job is to make that visible.
    expect(subjects).toHaveLength(2);
    warn.mockRestore();
  });

  it("does not report a row with no uri at all as malformed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const withEmptyRow = {
      ...extractedData,
      tables: {
        ...extractedData.tables,
        uiBlocks: [
          ...extractedData.tables.uiBlocks,
          // A trailing blank grid row: routine, not a defect.
          {
            _codaId: "i-4",
            name: "",
            tier: "Global",
            type: "Component",
            uri: "",
          },
        ],
      },
    };

    const { malformedRows } = transform(config, withEmptyRow);

    expect(malformedRows).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("should hard-fail when a configured table is missing from the extract", () => {
    const partial = {
      ...extractedData,
      tables: {
        uiBlocks: extractedData.tables.uiBlocks,
        uiBlockTypes: extractedData.tables.uiBlockTypes,
      },
    };

    // `tiers` is configured (as a reference) but absent from the extract:
    // the transform must refuse instead of silently regenerating without it.
    expect(() => transform(config, partial)).toThrow(
      "missing expected table(s): tiers",
    );
  });
});

describe("transform: blank rows versus half-created ones", () => {
  const context = {
    ds: NAMESPACES.ds,
    name: "ds:name",
    tier: { "@id": "ds:tier", "@type": "@id" },
  };

  /** A config whose uiBlocks table excludes rows with no name, as shipped. */
  const config = {
    format: "json-ld" as const,
    outputDir: "instances/",
    atomicity: "instance" as const,
    tables: {
      uiBlocks: {
        "@context": context,
        class: "{type}",
        uriTemplate: "{uri}",
        rowFilter: { nonEmpty: [{ column: "name" }] },
      },
    },
    references: {
      uiBlockTypes: {
        uriTemplate: `${NAMESPACES.ds}{Name}`,
        keyColumn: "Name",
      },
    },
  };

  function extract(rows: Array<Record<string, unknown>>) {
    return {
      document: "test-doc",
      extractedAt: "2024-01-01",
      tables: {
        uiBlocks: rows,
        uiBlockTypes: [{ _codaId: "i-type-1", Name: "Component" }],
      },
    };
  }

  const named = {
    _codaId: "i-1",
    name: "Button",
    tier: "Global",
    type: "Component",
    uri: `${NAMESPACES.ds}global.component.button`,
  };

  it("counts a nameless row as filtered and never as malformed", () => {
    // The shape that caused a 23-day outage: Coda creates a blank row, its
    // `uri` formula yields `ds:apps_support..`, and the fail-closed guard
    // stops every sync until someone deletes the row. Declaring the identity
    // filter makes it a counted non-event instead.
    const blank = {
      _codaId: "i-2",
      name: "",
      tier: "",
      type: "",
      uri: "ds:..",
    };

    const { tableStats, malformedRows, subjects } = transform(
      config,
      extract([named, blank]),
    );

    expect(malformedRows).toEqual([]);
    expect(subjects).toHaveLength(1);
    expect(tableStats.uiBlocks).toEqual({
      rows: 2,
      filtered: 1,
      eligible: 1,
      subjects: 1,
    });
  });

  it("still reports a degenerate uri on a row that has a name", () => {
    // The filter must not become a way to lose real work: a named row whose
    // uri is degenerate is a dangling reference, and stays fail-closed.
    const broken = {
      _codaId: "i-3",
      name: "Spinner",
      tier: "",
      type: "Component",
      uri: `${NAMESPACES.ds}..`,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { malformedRows, tableStats } = transform(
      config,
      extract([named, broken]),
    );

    expect(malformedRows).toEqual([
      { table: "uiBlocks", uri: `${NAMESPACES.ds}..` },
    ]);
    expect(tableStats.uiBlocks.filtered).toBe(0);
    warn.mockRestore();
  });

  it("reports a named row whose type resolves to nothing", () => {
    // Previously silent: resolveClass returned null and the row vanished with
    // no warning, no count and no guard.
    const untyped = {
      _codaId: "i-4",
      name: "Spinner",
      tier: "Global",
      type: "",
      uri: `${NAMESPACES.ds}global.component.spinner`,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { unclassifiableRows, subjects } = transform(
      config,
      extract([named, untyped]),
    );

    expect(unclassifiableRows).toEqual([
      { table: "uiBlocks", uri: `${NAMESPACES.ds}global.component.spinner` },
    ]);
    expect(subjects).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("resolved to nothing"),
    );
    warn.mockRestore();
  });

  it("leaves a healthy table with nothing filtered and nothing reported", () => {
    const { tableStats, malformedRows, unclassifiableRows } = transform(
      config,
      extract([named]),
    );

    expect(tableStats.uiBlocks).toEqual({
      rows: 1,
      filtered: 0,
      eligible: 1,
      subjects: 1,
    });
    expect(malformedRows).toEqual([]);
    expect(unclassifiableRows).toEqual([]);
  });
});

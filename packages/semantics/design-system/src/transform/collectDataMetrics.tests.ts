import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import collectDataMetrics from "./collectDataMetrics.js";

const TIER_TTL = `@prefix ds: <https://ds.canonical.com/>.

ds:global a ds:Tier;
    ds:name "Global".
`;

// 5 triples: type, name, hasProperty + 2 on the blank node.
const BUTTON_TTL = `@prefix ds: <https://ds.canonical.com/>.

ds:global.component.button a ds:Component;
    ds:name "Button";
    ds:hasProperty [ a ds:Property; ds:name "content" ].
`;

const TIER_JSONLD = JSON.stringify({
  "@context": { ds: "https://ds.canonical.com/" },
  "@id": "ds:global",
  "@type": "ds:Tier",
  "ds:name": "Global",
});

describe("collectDataMetrics", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "metrics-test-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("returns zero metrics for a directory that does not exist", async () => {
    const metrics = await collectDataMetrics(join(dir, "missing"), "ttl");

    expect(metrics).toEqual({
      files: 0,
      subjects: 0,
      tiers: 0,
      propertyUsage: 0,
    });
  });

  it("counts files, named subjects, tiers, and triples across a ttl tree", async () => {
    await writeFile(join(dir, "global.ttl"), TIER_TTL);
    await mkdir(join(dir, "global", "component"), { recursive: true });
    await writeFile(join(dir, "global", "component", "button.ttl"), BUTTON_TTL);

    const metrics = await collectDataMetrics(dir, "ttl");

    expect(metrics.files).toBe(2);
    // The blank node is not counted as a subject...
    expect(metrics.subjects).toBe(2);
    expect(metrics.tiers).toBe(1);
    // ...but its triples still count as property usage (2 tier + 5 button).
    expect(metrics.propertyUsage).toBe(7);
  });

  it("ignores files that do not match the configured extension", async () => {
    await writeFile(join(dir, "global.ttl"), TIER_TTL);
    await writeFile(join(dir, "notes.txt"), "not rdf");
    await writeFile(join(dir, "tier.jsonld"), TIER_JSONLD);

    const metrics = await collectDataMetrics(dir, "ttl");

    expect(metrics.files).toBe(1);
    expect(metrics.subjects).toBe(1);
  });

  it("skips unparseable files but still counts them as files", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await writeFile(join(dir, "global.ttl"), TIER_TTL);
    // Legacy source-data quirk: leading-dot local names are not valid Turtle.
    await writeFile(
      join(dir, "broken.ttl"),
      '@prefix ds: <https://ds.canonical.com/>.\n\nds:.modifier.light a ds:Modifier;\n    ds:name "Light".\n',
    );

    const metrics = await collectDataMetrics(dir, "ttl");

    expect(metrics.files).toBe(2);
    expect(metrics.subjects).toBe(1);
    expect(metrics.propertyUsage).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("skipping unparseable"),
    );
  });

  it("counts JSON-LD datasets through the same normalization path", async () => {
    await writeFile(join(dir, "global.jsonld"), TIER_JSONLD);

    const metrics = await collectDataMetrics(dir, "jsonld");

    expect(metrics).toEqual({
      files: 1,
      subjects: 1,
      tiers: 1,
      propertyUsage: 2,
    });
  });
});

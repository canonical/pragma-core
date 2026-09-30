import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../config/types.js";
import {
  ALLOW_MALFORMED_ROWS_ENV_VAR,
  ALLOW_SHRINK_ENV_VAR,
} from "../transform/deltaGuards.js";
import transform from "./transform.js";

const DS = "https://ds.canonical.com/";

describe("transform command", () => {
  it("should throw if transform config is missing", async () => {
    await expect(
      transform({ document: "doc", provider: "coda" }),
    ).rejects.toThrow("Transform config section is required");
  });

  it("should throw if extract output path is missing", async () => {
    await expect(
      transform({
        document: "doc",
        provider: "coda",
        transform: {
          format: "json-ld",
          outputDir: "instances/",
          atomicity: "instance",
          tables: {},
        },
      }),
    ).rejects.toThrow("Extract output path is required for transform");
  });

  describe("fail-closed pull sync guards", () => {
    let base: string;

    beforeEach(async () => {
      base = await mkdtemp(join(tmpdir(), "transform-cmd-test-"));
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      await rm(base, { recursive: true, force: true });
    });

    function makeConfig(overrides: Partial<Config> = {}): Config {
      return {
        document: "doc",
        provider: "coda",
        ...overrides,
        extract: { output: join(base, "extract.json"), tables: {} },
        transform: {
          format: "ttl",
          outputDir: join(base, "data"),
          atomicity: "instance",
          tables: {
            uiBlocks: {
              "@context": {
                ds: DS,
                name: "ds:name",
                anatomy_dsl: "ds:anatomyDsl",
                tier: { "@id": "ds:tier", "@type": "@id" },
              },
              class: "{type}",
              uriTemplate: "{uri}",
            },
            tiers: {
              "@context": { ds: DS, name: "ds:name" },
              class: "ds:Tier",
              uriTemplate: "{uri}",
            },
          },
          references: {
            tiers: { uriTemplate: "{uri}", keyColumn: "name" },
            uiBlockTypes: { uriTemplate: `${DS}{Name}`, keyColumn: "Name" },
          },
        },
      };
    }

    /** A uiBlocks row producing subject ds:global.component.block<n> (3 triples). */
    function blockRow(n: number, overrides: Record<string, unknown> = {}) {
      return {
        _codaId: `i-${n}`,
        name: `Block${n}`,
        tier: "Global",
        type: "Component",
        uri: `${DS}global.component.block${n}`,
        ...overrides,
      };
    }

    /** A tiers row producing subject ds:<name> (2 triples). */
    function tierRow(name: string) {
      return { _codaId: `i-tier-${name}`, name, uri: `${DS}${name}` };
    }

    function blocks(count: number) {
      return Array.from({ length: count }, (_, i) => blockRow(i + 1));
    }

    /** Extract fixture with all configured tables present. */
    function fullTables(
      uiBlocks: Record<string, unknown>[],
      tiers: Record<string, unknown>[] = [tierRow("global")],
    ) {
      return {
        uiBlocks,
        tiers,
        uiBlockTypes: [{ _codaId: "i-type-1", Name: "Component" }],
      };
    }

    async function runTransform(
      tables: Record<string, unknown[]>,
      overrides: Partial<Config> = {},
    ) {
      await writeFile(
        join(base, "extract.json"),
        JSON.stringify({ document: "doc", extractedAt: "2026-01-01", tables }),
      );
      await transform(makeConfig(overrides));
    }

    function exists(path: string): Promise<boolean> {
      return stat(path).then(
        () => true,
        () => false,
      );
    }

    const blockPath = (n: number) =>
      join(base, "data", "global", "component", `block${n}.ttl`);

    it("hard-fails when a configured table is missing from the extract", async () => {
      await expect(
        runTransform({
          uiBlocks: blocks(2),
          uiBlockTypes: [{ _codaId: "i-type-1", Name: "Component" }],
        }),
      ).rejects.toThrow("missing expected table(s): tiers");

      // Nothing was written.
      expect(await exists(join(base, "data"))).toBe(false);
    });

    it("hard-fails when a non-empty table yields zero subjects", async () => {
      // Rows without a resolvable `uri` produce no subjects at all.
      const broken = [{ _codaId: "i-1", name: "Block1", type: "Component" }];

      await expect(runTransform(fullTables(broken))).rejects.toThrow(
        "produced rows but zero subjects",
      );
      expect(await exists(join(base, "data"))).toBe(false);
    });

    it("hard-fails on a malformed upstream row, naming the offending URI", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      // A blank/dangling upstream reference leaves empty dot segments. The
      // row used to be skipped with a warning, so the only downstream signal
      // was a deletion count in a different guard; now it fails on day one.
      const rows = [...blocks(2), blockRow(3, { uri: `${DS}global..` })];

      const run = runTransform(fullTables(rows));

      await expect(run).rejects.toThrow("Malformed upstream row");
      await expect(run).rejects.toThrow("global..");
      await expect(run).rejects.toThrow("uiBlocks");
      await expect(run).rejects.toThrow("Fix the uri");
      // Fails before anything is written.
      expect(await exists(join(base, "data"))).toBe(false);
    });

    it("does not fail on a row with no uri at all", async () => {
      // A trailing blank grid row is a routine skip, not a defect.
      const rows = [...blocks(2), blockRow(3, { uri: "" })];

      await expect(runTransform(fullTables(rows))).resolves.toBeUndefined();
      expect(await exists(blockPath(1))).toBe(true);
    });

    it("lets a malformed row through with its own escape hatch", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv(ALLOW_MALFORMED_ROWS_ENV_VAR, "1");
      const rows = [...blocks(2), blockRow(3, { uri: `${DS}global..` })];

      await expect(runTransform(fullTables(rows))).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(ALLOW_MALFORMED_ROWS_ENV_VAR),
      );
    });

    it("refuses a large shrink and leaves the committed dataset intact", async () => {
      await runTransform(fullTables(blocks(10)));
      expect(await exists(blockPath(5))).toBe(true);

      // Simulated broken extract: most blocks vanished.
      await expect(runTransform(fullTables(blocks(2)))).rejects.toThrow(
        "Refusing to overwrite committed data",
      );

      // The committed dataset was never destroyed.
      expect(await exists(blockPath(5))).toBe(true);
      expect(await exists(blockPath(10))).toBe(true);
      expect(await exists(join(base, "data", "global.ttl"))).toBe(true);
    });

    it("fails when authored content shrinks even though subjects survive", async () => {
      await runTransform(fullTables(blocks(10)));

      // Same subjects, but two blocks lost their authored `name` content.
      const stripped = blocks(10).map((row, i) =>
        i < 2 ? blockRow(i + 1, { name: undefined }) : row,
      );

      await expect(runTransform(fullTables(stripped))).rejects.toThrow(
        /property usage/,
      );
      expect(await exists(blockPath(1))).toBe(true);
    });

    it("fails when a tier file would disappear", async () => {
      const twoTiers = [tierRow("global"), tierRow("apps")];
      await runTransform(fullTables(blocks(10), twoTiers));

      await expect(
        runTransform(fullTables(blocks(10), [tierRow("global")])),
      ).rejects.toThrow(/tier file count/);
      expect(await exists(join(base, "data", "apps.ttl"))).toBe(true);
    });

    it("lets an intentional shrink through with the escape hatch", async () => {
      await runTransform(fullTables(blocks(10)));

      vi.stubEnv(ALLOW_SHRINK_ENV_VAR, "1");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await runTransform(fullTables(blocks(2)));

      expect(await exists(blockPath(1))).toBe(true);
      // Stale files from the previous, larger dataset were swept.
      expect(await exists(blockPath(5))).toBe(false);
    });

    it("replaces the dataset and sweeps stale files on a healthy run", async () => {
      await runTransform(fullTables([blockRow(1), blockRow(2)]));

      await runTransform(fullTables([blockRow(1), blockRow(3), blockRow(4)]));

      expect(await exists(blockPath(2))).toBe(false);
      expect(await exists(blockPath(3))).toBe(true);
      expect(await exists(blockPath(4))).toBe(true);
    });
    it("refuses the transform when a derived record consumes an unregistered symbol and leaves the committed dataset intact", async () => {
      // The fourth fail-closed layer (ADR J §8.2): the anatomy parses, the record is
      // derived, and `modifier.surface` resolves in neither S1 nor S2 with no register
      // row to admit it.
      await runTransform(fullTables(blocks(2)));
      vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(
        runTransform(
          fullTables([
            blockRow(1, {
              anatomy_dsl:
                "node:\n  uri: global.component.block1\n  styles:\n    appearance.background: modifier.surface\n",
            }),
            blockRow(2),
          ]),
        ),
      ).rejects.toThrow("token-binding guard reported");

      expect(await exists(blockPath(1))).toBe(true);
      expect(await exists(blockPath(2))).toBe(true);
    });

    it("skips and reports an anatomy that does not parse, and writes every other block's records", async () => {
      // One bad cell in the source document must not stop every other edit from
      // syncing: the anatomy is left out and named on a `Skipping` line, which the sync
      // workflow lists in its run summary and in the sync pull request.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      await runTransform(
        fullTables([
          blockRow(1, {
            anatomy_dsl:
              "node:\n  uri: global.component.block1\n  styles:\n    typography.color: color/text\n",
          }),
          blockRow(2, {
            anatomy_dsl:
              "node:\n  uri: global.component.block2\n  styles:\n    typography.color: color.text\n",
          }),
        ]),
      );

      expect(
        warn.mock.calls.filter(([line]) => String(line).startsWith("Skipping")),
      ).toEqual([
        [
          expect.stringMatching(
            /^Skipping the anatomy of global\.component\.block1 — it does not parse/,
          ),
        ],
      ]);
      const skipped = await readFile(blockPath(1), "utf-8");
      const kept = await readFile(blockPath(2), "utf-8");
      expect(skipped).not.toContain("consumesSymbol");
      expect(kept).toContain("consumesSymbol");
    });

    it("still refuses another token-binding finding on a run that skipped an anatomy", async () => {
      await runTransform(fullTables(blocks(2)));
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(
        runTransform(
          fullTables([
            blockRow(1, {
              anatomy_dsl:
                "node:\n  uri: global.component.block1\n  styles:\n    typography.color: color/text\n",
            }),
            blockRow(2, {
              anatomy_dsl:
                "node:\n  uri: global.component.block2\n  styles:\n    appearance.background: modifier.surface\n",
            }),
          ]),
        ),
      ).rejects.toThrow("token-binding guard reported");
    });

    it("lets an unregistered symbol through with allowUnboundSymbols set", async () => {
      // The pair that proves the suppression suppresses ONE row of the exit-code
      // table: the same corpus, the same missing register row, and the only difference
      // is the flag.
      await runTransform(
        fullTables([
          blockRow(1, {
            anatomy_dsl:
              "node:\n  uri: global.component.block1\n  styles:\n    typography.color: modifier.color.notasymbol\n",
          }),
        ]),
        { allowUnboundSymbols: true },
      );

      expect(await exists(blockPath(1))).toBe(true);
    });
  });
});

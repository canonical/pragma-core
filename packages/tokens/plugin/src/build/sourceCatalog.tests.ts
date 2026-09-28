import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSourceCatalog, walkTokens } from "./sourceCatalog.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("walkTokens", () => {
  it("preserves token IDs for ordinary leaves and $root leaves", () => {
    const ids: string[] = [];
    walkTokens(
      {
        spacing: {
          $type: "dimension",
          baseline: { $value: "0.5rem" },
          gap: { field: { $root: { $value: "1rem" } } },
        },
      },
      [],
      (id) => ids.push(id),
    );

    expect(ids).toEqual(["spacing.baseline", "spacing.gap.field"]);
  });
});

describe("loadSourceCatalog", () => {
  it("records resolver source role and provenance", () => {
    const directory = mkdtempSync(join(tmpdir(), "canonical-source-catalog-"));
    temporaryDirectories.push(directory);
    mkdirSync(join(directory, "primitive"));
    writeJson(join(directory, "primitive", "dimension.tokens.json"), {
      dimension: { $type: "dimension", base: { $value: "1rem" } },
    });
    writeJson(join(directory, "canonical.resolver.json"), {
      sets: {
        primitive: {
          sources: [{ $ref: "primitive/dimension.tokens.json" }],
        },
      },
    });

    const catalog = loadSourceCatalog(directory);
    expect(catalog.get("dimension.base")).toEqual({
      role: "primitive",
      sourceFile: "primitive/dimension.tokens.json",
    });
    expect([...(catalog.ids?.() ?? [])]).toEqual(["dimension.base"]);
  });

  it("rejects a token declared in both primitive and semantic source roles", () => {
    const directory = mkdtempSync(join(tmpdir(), "canonical-source-catalog-"));
    temporaryDirectories.push(directory);
    mkdirSync(join(directory, "primitive"));
    mkdirSync(join(directory, "semantic"));
    writeJson(join(directory, "primitive", "dimension.tokens.json"), {
      dimension: { $type: "dimension", shared: { $value: "1rem" } },
    });
    writeJson(join(directory, "semantic", "spacing.tokens.json"), {
      dimension: { $type: "dimension", shared: { $value: "1rem" } },
    });
    writeJson(join(directory, "canonical.resolver.json"), {
      sets: {
        primitive: {
          sources: [{ $ref: "primitive/dimension.tokens.json" }],
        },
      },
      modifiers: {
        product: {
          contexts: {
            site: [{ $ref: "semantic/spacing.tokens.json" }],
          },
        },
      },
    });

    expect(() => loadSourceCatalog(directory)).toThrow(
      /dimension\.shared is declared as both primitive .* and semantic/,
    );
  });
});

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value), "utf8");
}

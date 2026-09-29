/**
 * House conventions on the token files — the things the specification permits
 * but we have decided against.
 *
 * Structural conformance is **not** checked here. It moved to
 * `conformance.tests.ts`, which validates against the official DTCG JSON
 * Schemas. What this file used to do — a hand-written `KNOWN_TYPES` set and a
 * regex for alias references — was an approximation of the specification
 * maintained by hand, and so drifted from it silently. That drift is not
 * hypothetical: it is how the retracted "34.2% pure" figure came about, by
 * scoring the source against draft-era rules the published specification does
 * not contain.
 *
 * What remains here is only what the schema cannot express, because it is our
 * preference rather than the specification's requirement.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS_DIR = join(import.meta.dirname, "../tokens/canonical");

/**
 * The schema declares `$schema` a free-form URI reference, so it would accept
 * a file pinned to any version — including none. Pinning every file to one
 * version is what makes "conformance" a single measurable claim.
 */
const EXPECTED_SCHEMA = "https://designtokens.org/schemas/2025.10/format.json";

function findTokenFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name.endsWith(".tokens.json")) {
      out.push(join(entry.parentPath ?? dir, entry.name));
    }
  }
  return out.sort();
}

const tokenFiles = findTokenFiles(TOKENS_DIR);

describe("token file conventions", () => {
  it("finds token files", () => {
    expect(tokenFiles.length).toBeGreaterThan(0);
  });

  describe.each(tokenFiles.map((f) => [relative(TOKENS_DIR, f), f] as const))(
    "%s",
    (_label, filePath) => {
      const json = JSON.parse(readFileSync(filePath, "utf8")) as Record<
        string,
        unknown
      >;

      it("pins $schema to the 2025.10 format schema", () => {
        expect(json.$schema).toBe(EXPECTED_SCHEMA);
      });

      it("explains itself when it holds no tokens", () => {
        // An empty file is either a deliberate placeholder or an accident, and
        // the two are indistinguishable without a sentence saying which.
        const tokenKeys = Object.keys(json).filter((k) => !k.startsWith("$"));
        if (tokenKeys.length > 0) return;
        expect(typeof json.$description).toBe("string");
        expect((json.$description as string).length).toBeGreaterThan(0);
      });
    },
  );
});

/**
 * Specification conformance, measured against the **official** DTCG JSON
 * Schemas rather than a hand-written approximation of them.
 *
 * The distinction matters and is the reason this file exists. A hand-rolled
 * validator encodes what its author believed the specification said, and drifts
 * silently from what it actually says — which is exactly how the retracted
 * "34.2% pure" figure came about, by scoring our source against draft-era rules
 * that the published specification does not contain.
 *
 * Five files do not validate today. They are named individually below rather
 * than counted, so that a *new* failure is a test failure while the known ones
 * stay visible and attributable.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Ajv, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

const TOKENS_DIR = join(import.meta.dirname, "../tokens/canonical");
const SCHEMA_DIR = join(import.meta.dirname, "../schemas");
const RESOLVER = "canonical.resolver.json";

/**
 * The N2 defect, in the specification's own terms: `color.foreground.ghost`
 * carries a `$value` — which makes it a token — while also carrying member
 * keys `branded`, `constructive`, `destructive` — which makes it a group. The
 * format schema offers `oneOf` a token or a group, and such a node is neither,
 * so it matches no branch and is reported as a token with additional
 * properties.
 *
 * The remedy is what `$root` exists for: move the node's own `$value` into a
 * `$root` child and leave the members beside it. That is P7's job, not this
 * file's.
 */
/**
 * Files known not to validate, each with the defect that explains it.
 *
 * **Empty, and that is the point of this change.** It held nine: the five
 * surface files that stated `color.foreground.ghost` as a token AND a group,
 * and the four criticality files that came to state `color.text` the same way
 * when `color.text.onForegroundSecondary` was added. All nine now move their
 * own `$value` onto a `$root` child, which is what `$root` is for, so every
 * one of the 45 files validates against the specification's schema.
 *
 * It stays a **ratchet, not an allowlist**: the assertion compares the failing
 * set to this one exactly, so a file joining an empty set fails immediately.
 *
 * What is NOT closed is a different defect on four of those files — a modifier
 * still rebinds `color.text.onForegroundSecondary` as a token where the base
 * authors a group. That is invisible to the schema, which sees a well-formed
 * token in one file and a well-formed group in another, and it is asserted by
 * name in `rootRemedies.tests.ts` instead.
 */
const KNOWN_INVALID: Readonly<Record<string, string>> = {};

/** @note reads from disk. */
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));

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

function compile(schemaFile: string): ValidateFunction {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson(join(SCHEMA_DIR, schemaFile)) as object);
}

const validateFormat = compile("format.json");
const validateResolver = compile("resolver.json");
const tokenFiles = findTokenFiles(TOKENS_DIR);

/** The relative path each file is known by, matching KNOWN_INVALID's keys. */
const label = (path: string): string =>
  relative(TOKENS_DIR, path).split("\\").join("/");

describe("DTCG conformance", () => {
  it("discovers the token files by walking the directory", () => {
    // The subject is the directory, never a list — a file added without being
    // registered anywhere is still measured. Asserting a floor stops an empty
    // or mis-rooted walk from making every case below pass vacuously.
    expect(tokenFiles.length).toBe(45);
  });

  it("the resolver document validates", () => {
    const valid = validateResolver(readJson(join(TOKENS_DIR, RESOLVER)));
    expect(validateResolver.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it("exactly the known-invalid files fail, and no others", () => {
    const failing = tokenFiles
      .filter((path) => !validateFormat(readJson(path)))
      .map(label)
      .sort();

    // Compared as sets rather than counted: a file that starts validating is
    // as much a change to explain as one that stops.
    expect(failing).toEqual(Object.keys(KNOWN_INVALID).sort());
  });

  describe.each(
    tokenFiles
      .filter((path) => !(label(path) in KNOWN_INVALID))
      .map((path) => [label(path), path] as const),
  )("%s", (_name, path) => {
    it("validates against the official format schema", () => {
      const valid = validateFormat(readJson(path));
      expect(validateFormat.errors ?? []).toEqual([]);
      expect(valid).toBe(true);
    });
  });
});

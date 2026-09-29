/**
 * The extracted configuration and the constants it was extracted from must
 * agree, for as long as both exist.
 *
 * `packages/tokens/contracts/interactiveRoles.json` and `profiles/css.json`
 * were generated from the constants beside this file, and the plugin still
 * falls back to those constants when no configuration is passed. Two copies of
 * one fact is exactly the shape that drifts — and the drift was not
 * hypothetical: the two copies once disagreed about whether the `contrasted`
 * surface provisions `color.text`, which left disabled text drawn in the
 * background's own colour inside a contrasted region. Found by comparing them
 * by hand, and fixed by setting the flag on both.
 *
 * This compares them mechanically instead. When the constants are deleted and
 * the configuration becomes the only source, this file goes with them.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { interactiveRoles } from "./interactiveRoles.js";
import { SURFACE_EMITS, SURFACE_RESETS } from "./surfaceEmission.js";
import { SURFACE_SELECTOR_MAP } from "./surfaceSelectorMap.js";

/** The sibling package the configuration is authored in. */
const TOKENS_PKG = join(import.meta.dirname, "../../../../tokens");

/** @note reads from disk. */
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(join(TOKENS_PKG, rel), "utf8"));

describe("extracted configuration matches its constants", () => {
  it("carries every interactive role, unchanged", () => {
    const contracts = readJson("contracts/interactiveRoles.json") as {
      roles: unknown;
    };
    // Deep equality, not a count: a role whose `hasSurface` flips is the
    // defect class this guards, and a count would not see it.
    expect(contracts.roles).toEqual(interactiveRoles);
  });

  it("carries every surface selector, unchanged", () => {
    const profile = readJson("profiles/css.json") as {
      surfaceSelectors: unknown;
    };
    expect(profile.surfaceSelectors).toEqual(SURFACE_SELECTOR_MAP);
  });

  it("compares non-empty data, so equality cannot hold vacuously", () => {
    expect(interactiveRoles.length).toBe(14);
    expect(Object.keys(SURFACE_SELECTOR_MAP).length).toBe(5);
  });
  it("carries every surface emission set, unchanged", () => {
    const profile = readJson("profiles/css.json") as {
      surfaceEmits: unknown;
      surfaceResets: unknown;
    };
    // Deep equality again: a context that loses one variable is a shipped API
    // that quietly shrank, which no count would catch.
    expect(profile.surfaceEmits).toEqual(SURFACE_EMITS);
    expect(profile.surfaceResets).toEqual(SURFACE_RESETS);
  });
});

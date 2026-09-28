/**
 * The three `@terrazzo/*` packages are one toolchain and must pin one version.
 *
 * They were skewed once — the CLI and parser at 2.7.1 while the plugin
 * transformed values with token-tools at 2.0.0 — and the skew was invisible
 * until it changed the emitted CSS. Renovate now groups the three so they move
 * together, but grouping only combines updates that are *available* at the
 * same moment: if one package publishes and the others do not, Renovate can
 * still open a partial group and reintroduce the skew. There is no Renovate
 * option that waits for all three.
 *
 * So the guard is here instead, where it cannot be bypassed by how a bot
 * batches its pull requests: whatever lands, the three versions must agree.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

/** @note reads from disk. */
const deps = (pkg: string): Record<string, string> => {
  const json = JSON.parse(
    readFileSync(join(ROOT, pkg, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...json.dependencies, ...json.devDependencies };
};

describe("the terrazzo toolchain pins one version", () => {
  it("agrees across cli, parser and token-tools", () => {
    const tokens = deps("tokens");
    const plugin = deps("plugin");

    const pinned = {
      "@terrazzo/cli": tokens["@terrazzo/cli"],
      "@terrazzo/parser": tokens["@terrazzo/parser"],
      "@terrazzo/token-tools": plugin["@terrazzo/token-tools"],
    };

    // Named in the failure rather than counted, so the message says which
    // package is out of step and at which version.
    expect(new Set(Object.values(pinned)).size, JSON.stringify(pinned)).toBe(1);
  });

  it("pins exactly, with no range prefix", () => {
    // A range would let the three drift apart at install time without any
    // package.json ever disagreeing.
    const tokens = deps("tokens");
    const plugin = deps("plugin");
    for (const version of [
      tokens["@terrazzo/cli"],
      tokens["@terrazzo/parser"],
      plugin["@terrazzo/token-tools"],
    ]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

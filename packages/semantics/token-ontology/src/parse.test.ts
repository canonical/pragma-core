/**
 * Every Turtle file in the package parses, and the graph holds what the
 * populator reported.
 *
 * The subject is each directory, never a list of filenames, so a new stratum
 * is covered the moment it is written. Counts are asserted with their
 * denominators because a count that drifts silently is the failure mode this
 * package exists to prevent.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser, type Quad } from "n3";
import { describe, expect, it } from "vitest";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const turtleFiles = (dir: string): string[] =>
  readdirSync(join(PKG, dir))
    .filter((f) => f.endsWith(".ttl"))
    .sort()
    .map((f) => join(dir, f));

/** @note reads from disk. */
function parse(rel: string): Quad[] {
  return new Parser({ format: "text/turtle" }).parse(
    readFileSync(join(PKG, rel), "utf8"),
  );
}

const DIRECTORIES = ["definitions", "data", "samples"];

describe("turtle parses", () => {
  const files = DIRECTORIES.flatMap(turtleFiles);

  it("finds files to parse in every directory", () => {
    // Without this, deleting a directory would make every case below vacuous.
    for (const dir of DIRECTORIES)
      expect(turtleFiles(dir).length).toBeGreaterThan(0);
  });

  it.each(files)("%s", (rel) => {
    expect(parse(rel).length).toBeGreaterThan(0);
  });
});

describe("the strata hold what the populator reported", () => {
  const quads = ["data/s1.ttl", "data/s2.ttl", "data/s3.ttl"].flatMap(parse);
  const A = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const DT = "https://dt.canonical.com/";
  const W3C = "https://dt.canonical.com/w3c-tokens/";

  const countOf = (cls: string): number =>
    quads.filter((q) => q.predicate.value === A && q.object.value === cls)
      .length;

  it.each([
    [`${W3C}File`, 45],
    // 1311 includes the 68 new authored definitions from the baseline and
    // product-spacing documents, after the prior 30 identity rebinds were
    // removed from layer1 and modal.
    // authored (15 each) are no longer tokens anywhere. They stated a RESET —
    // an alias naming the node it sat on — which the source cannot express
    // once the override moves to $root, so the CSS profile carries them.
    [`${W3C}Token`, 1311],
    [`${W3C}ResolverContext`, 44],
    [`${W3C}ResolverModifier`, 10],
    // 745 = the 720 authored symbols of s1, plus the 25 channels s2 mints
    // from coverage. The channels are symbols like any other; what makes one a
    // channel is dt:channelOf, not a class.
    [`${DT}TokenSymbol`, 745],
    // Breakpoint no longer covers a semantic token after its baseline is
    // retired, so the observed-coverage draft omits that empty contract.
    [`${DT}Contract`, 9],
    [`${DT}Coordinate`, 36],
    // 1,237 = 1,072 along mode, plus one channel routing per (channel x
    // coordinate) pair the platform provisions — 165. Not 330: a routing
    // carries no value of its own, so there is nothing for a second row at
    // mode.dark to hold, and the mode coordinate is off the node.
    [`${DT}ResolvedValue`, 1237],
  ])("%s → %i", (cls, expected) => {
    expect(countOf(cls)).toBe(expected);
  });
});

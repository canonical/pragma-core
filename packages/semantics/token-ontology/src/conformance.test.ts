/**
 * The conformance harness: the populator's merge against terrazzo's.
 *
 * Both compute the same thing from the same source by different code. The
 * populator implements the specification's merge directly (`mergeFor`); the
 * build reaches its answer through terrazzo's parser and this repository's
 * plugin. Comparing them is the only check here that is not circular — every
 * other test in this package compares the graph to itself.
 *
 * The two do not agree by identity, and should not: the artifact carries
 * projection facts the graph deliberately omits. A typography composite is one
 * decision and the graph holds it whole, while the build explodes each into its
 * slots and emits them for every context of every modifier — where the graph
 * resolves the all-defaults position only. So the artifact is the larger set
 * and the whole of the difference is typography. **Every symbol on either side
 * is accounted for below**, which is the actual claim — an unexplained symbol
 * on either side is a real divergence.
 *
 * Values are compared where both sides hold a literal one. `dt:resolvesTo`
 * holds specification-form JSON and the artifact holds CSS strings, so the
 * comparison goes through a small parse of the CSS `oklch()` form — lightness,
 * chroma and alpha exact, hue within a tolerance for the build's rounding. A
 * derived value carries no `dt:resolvesTo` at all — S3's channel routings are
 * the whole of that population — and they are out of scope here by position
 * before the absence of a value is ever reached.
 *
 * What stays out of scope is the rest of the artifact: a value that is a
 * `var()` reference has no literal to compare, and resolving it would mean
 * evaluating the CSS cascade — the equivalence check itself, not an input to
 * it. So this harness proves the two agree on WHICH symbols resolve, WHERE
 * they are themed, and on every literal colour; it does not prove agreement
 * on values the build states as references.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = createRequire(import.meta.url).resolve(
  "@canonical/design-tokens/dist/tokens.json",
);

interface ArtifactToken {
  id: string | null;
  isPaired: boolean;
}

/**
 * Symbols the graph resolves along mode, split by whether the position is
 * theme-dark.
 *
 * Values at a position outside mode are out of this harness's scope, and the
 * scope is what makes the comparison meaningful: both sides are asked what a
 * symbol resolves to with every family at its default, and once more with the
 * theme dark. S3's channel routings sit at a modifier coordinate instead, so a
 * channel would arrive here as a symbol the build never emits — an
 * unaccounted-for surplus, which is exactly the signal this file reserves for
 * a real divergence. Selecting on the POSITION rather than on the symbol's
 * name is what keeps that true for any future non-mode position too, and it is
 * still the reason the channels are excluded: they carry fewer coordinates
 * than they did — one, never a mode — but the one they carry is a modifier
 * coordinate, so the filter below rejects them on exactly the ground it
 * always did rather than incidentally.
 */
function readStrata(): { base: Set<string>; dark: Set<string> } {
  const ttl = readFileSync(join(PKG, "data/s3.ttl"), "utf8");
  const base = new Set<string>();
  const dark = new Set<string>();
  for (const block of ttl.split(/\n\n+/)) {
    if (!block.includes("a dt:ResolvedValue")) continue;
    const symbol = /dt:forSymbol dt:([^\s;]+)/.exec(block)?.[1];
    if (!symbol) continue;
    const coordinates = [
      ...block.matchAll(/dt:coordinate dt:coordinate\.([^\s;.]+)\.[^\s;]+/g),
    ].map((m) => m[1]);
    if (coordinates.some((family) => family !== "mode")) continue;
    const isDark = block.includes("dt:coordinate dt:coordinate.mode.dark");
    (isDark ? dark : base).add(symbol);
  }
  return { base, dark };
}

/** @note reads the built artifact; requires `bun run build` in packages/tokens. */
function readArtifact(): {
  ids: Set<string>;
  paired: Set<string>;
  identified: number;
} {
  const raw = JSON.parse(readFileSync(ARTIFACT, "utf8")) as Record<
    string,
    ArtifactToken
  >;
  const ids = new Set<string>();
  const paired = new Set<string>();
  let identified = 0;
  for (const token of Object.values(raw)) {
    // A derived entry (a delta) carries no id: it is computed, not resolved.
    if (!token.id) continue;
    identified += 1;
    ids.add(token.id);
    if (token.isPaired) paired.add(token.id);
  }
  return { ids, paired, identified };
}

const { base, dark } = readStrata();
const { ids, paired, identified } = readArtifact();

const only = (a: Set<string>, b: Set<string>): string[] =>
  [...a].filter((s) => !b.has(s)).sort();

/** What each side resolves and the other does not. Both are accounted for below. */
const graphSurplus = only(base, ids);
const buildSurplus = only(ids, base);

describe("the graph and the build agree on which symbols resolve", () => {
  it("compares non-empty sets, so no assertion below holds vacuously", () => {
    expect(base.size).toBe(718);
    expect(ids.size).toBe(878);
    // And no set below owes its size to deduplication: every artifact entry
    // that carries an id carries a distinct one.
    expect(identified).toBe(ids.size);
  });

  it("shares 691 symbols", () => {
    const shared = [...base].filter((s) => ids.has(s));
    expect(shared.length).toBe(691);
    // Among them all 115 `number.*` — the lightness, chroma and hue parameters
    // the derivation rules consume. The artifact names every one, which is why
    // the graph's surplus below holds none.
    expect(shared.filter((s) => s.startsWith("number.")).length).toBe(115);
  });

  it("the graph's surplus is exactly the typography composites", () => {
    const numbers = graphSurplus.filter((s) => s.startsWith("number."));
    const composites = graphSurplus.filter((s) => s.startsWith("typography."));

    // No `number.*`: the build resolves all 115 alongside the graph, so they
    // are shared rather than surplus. Pinned at zero rather than dropped — a
    // build that went back to folding them into deltas without naming them
    // would be a regression, and this is where it would show.
    expect(numbers.length).toBe(0);
    // 27 typography composites stay whole in the graph, where a composite is
    // one decision. The build explodes each into its slots — see below.
    expect(composites.length).toBe(27);
    // Nothing else. This is the assertion that would catch a real divergence.
    expect(graphSurplus.length).toBe(numbers.length + composites.length);
  });

  it("the build's surplus is exactly the typography explosion", () => {
    // 29 composites, each exploded into its slots: six universal ones
    // (font-family, font-size, font-weight, letter-spacing, line-height and
    // line-height-dimension) across all 29, plus font-variant-numeric on 11 of
    // them and font-variant on 2. 174 + 11 + 2.
    expect(buildSurplus.length).toBe(187);
    // Every one of those symbols is typography, with no exception.
    expect(buildSurplus.every((s) => s.startsWith("typography."))).toBe(true);
    // And 29 composites, not the 27 the graph holds whole. The other two are
    // `typography.heading.display` and its bold, which the graph resolves
    // nowhere: they are defined only in the `site` context of the `product`
    // modifier, and the graph resolves at the all-defaults position, where
    // `product` is `global`. The build emits every context, so their slots
    // appear here. Naming the two keeps this an accounting rather than a count
    // — a composite reaching the artifact with no counterpart on either list
    // would otherwise pass unremarked.
    const composites = new Set(
      buildSurplus.map((s) => s.replace(/\.[^.]+$/, "")),
    );
    expect(composites.size).toBe(29);
    expect(only(composites, new Set(graphSurplus))).toEqual([
      "typography.heading.display",
      "typography.heading.display.bold",
    ]);
  });
});

describe("themed means covered by mode, not divergent in value (D10)", () => {
  it("pairs 261 symbols where light and dark differ", () => {
    expect(paired.size).toBe(261);
  });

  it("covers 354 symbols with the mode family", () => {
    expect(dark.size).toBe(354);
  });

  it("every paired symbol is covered, and coverage is strictly wider", () => {
    // The containment is the point. 93 symbols are provisioned by mode and
    // resolve to the same value in both branches — themed without differing.
    // A build that inferred coverage from difference would lose them, and
    // this is where that would show.
    expect(only(paired, dark)).toEqual([]);
    expect(dark.size - paired.size).toBe(93);
  });
});

/**
 * The value axis: what the two merges resolve to, not merely which symbols.
 *
 * Only part of the artifact can be compared this way, and the reason is the
 * provision thesis rather than a gap. The graph resolves a symbol THROUGH its
 * alias chain to a terminal value; the artifact deliberately keeps the alias,
 * emitting `var(--color-palette-white)` so a page can move between points
 * without re-resolving. Those are the two encodings P2 describes, and 385 of
 * the artifact's 878 values are references rather than literals.
 *
 * Comparing a reference to a value would mean evaluating the CSS custom
 * property graph — the point-wise equivalence check itself, which is a larger
 * exercise than this file. What is compared here is every position where both
 * sides hold a literal oklch colour.
 */

/** `oklch(97.9% 0.0041 337.35)` or `oklch(… / 0.15)`. */
const OKLCH = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/;

interface OklchValue {
  colorSpace?: string;
  components?: number[];
  alpha?: number;
}

/**
 * Terrazzo rounds hue when it serialises; the graph keeps the authored
 * precision. 0.05 degrees is below any perceptible difference and well under
 * that rounding, so it separates a formatting choice from a real divergence.
 * Every other channel is compared at float precision.
 */
const HUE_TOLERANCE = 0.05;
const EXACT = 1e-9;

function readValues(): {
  base: Map<string, unknown>;
  dark: Map<string, unknown>;
} {
  const ttl = readFileSync(join(PKG, "data/s3.ttl"), "utf8");
  const base = new Map<string, unknown>();
  const dark = new Map<string, unknown>();
  for (const block of ttl.split(/\n\n+/)) {
    if (!block.includes("a dt:ResolvedValue")) continue;
    const symbol = /dt:forSymbol dt:([^\s;]+)/.exec(block)?.[1];
    const raw = /dt:resolvesTo "((?:[^"\\]|\\.)*)"\^\^rdf:JSON/.exec(
      block,
    )?.[1];
    if (!symbol || !raw) continue;
    // The same position filter readStrata applies, for the same reason and to
    // keep the two halves of this harness reading the same values. Doubly
    // inert on the channels today — a channel routing carries no
    // dt:resolvesTo, so the `raw` guard above already drops it, and a channel
    // symbol is not an artifact id either — but the filter is what protects
    // the NEXT non-mode position on a symbol the build DOES emit, which would
    // otherwise be compared against the artifact's mode-default value.
    const coordinates = [
      ...block.matchAll(/dt:coordinate dt:coordinate\.([^\s;.]+)\.[^\s;]+/g),
    ].map((m) => m[1]);
    if (coordinates.some((family) => family !== "mode")) continue;
    const value: unknown = JSON.parse(JSON.parse(`"${raw}"`) as string);
    (block.includes("dt:coordinate dt:coordinate.mode.dark") ? dark : base).set(
      symbol,
      value,
    );
  }
  return { base, dark };
}

interface Divergence {
  symbol: string;
  channel: string;
  graph: number;
  build: number;
}

/** Compare every position where both sides hold a literal oklch colour. */
function compareValues(): { compared: number; divergences: Divergence[] } {
  const values = readValues();
  const raw = JSON.parse(readFileSync(ARTIFACT, "utf8")) as Record<
    string,
    ArtifactToken & { valueLight?: unknown; valueDark?: unknown }
  >;
  const divergences: Divergence[] = [];
  let compared = 0;

  for (const [branch, key] of [
    ["base", "valueLight"],
    ["dark", "valueDark"],
  ] as const) {
    const side = values[branch];
    for (const token of Object.values(raw)) {
      if (!token.id) continue;
      const graph = side.get(token.id) as OklchValue | undefined;
      const built = token[key];
      if (!graph || graph.colorSpace !== "oklch" || typeof built !== "string") {
        continue;
      }
      const parts = OKLCH.exec(built);
      if (!parts) continue; // a var() reference, or another colour space
      compared += 1;

      const components = graph.components ?? [];
      const check = (channel: string, a: number, b: number, tol: number) => {
        // A missing graph component or an unparseable CSS number arrives as
        // undefined or NaN, and every comparison with NaN is false — so the
        // tolerance test would pass it as conforming. Absence of a value is a
        // divergence, not agreement.
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          divergences.push({
            symbol: token.id as string,
            channel,
            graph: a,
            build: b,
          });
          return;
        }
        if (Math.abs(a - b) > tol) {
          divergences.push({
            symbol: token.id as string,
            channel,
            graph: a,
            build: b,
          });
        }
      };
      check("lightness", components[0], Number(parts[1]) / 100, EXACT);
      check("chroma", components[1], Number(parts[2]), EXACT);
      check("hue", components[2], Number(parts[3]), HUE_TOLERANCE);
      check("alpha", graph.alpha ?? 1, parts[4] ? Number(parts[4]) : 1, EXACT);
    }
  }
  return { compared, divergences };
}

describe("the graph and the build agree on what those symbols resolve to", () => {
  const { compared, divergences } = compareValues();

  it("compares 443 literal oklch values across both branches", () => {
    // The denominator is asserted so a parser change that silently stopped
    // matching cannot turn this suite into a no-op that still passes.
    expect(compared).toBe(443);
  });

  it("agrees on every one of them", () => {
    expect(divergences).toEqual([]);
  });
});

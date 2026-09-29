/**
 * The catalogue's committed list, and its six laws.
 *
 * The laws had run once, by hand, and their results lived in a design
 * document. A result in a document is a fact about a day; pinned here, each is
 * a fact about the branch. L3, L4 and L5 must be zero — a non-zero one is a
 * defect, not a datum. L6 is 29 today and that total is ACCEPTED, so it is
 * pinned per population rather than as a total: 16 orphaned deltas and 13
 * typography slots are the two known ones, and a new orphan in either fails
 * here instead of raising a total nobody reads.
 *
 * @note reads `packages/tokens/dist`; requires `bun run build` in that package.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";
import { describe, expect, it } from "vitest";
import {
  build,
  channelSymbol,
  cssFiles,
  isChannelVariable,
  KNOWN_CHANNELS,
  kebabTwin,
  laws,
  parseCssText,
  readCss,
  references,
} from "./catalogue.js";
import { loadSource, mintChannels, observedCoverage } from "./populate.js";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const b = build();
const { findings } = laws(b);

const emitted = b.names.filter(isChannelVariable).sort();
const minted = KNOWN_CHANNELS.filter((c) => c.kind === "minted").map(
  (c) => c.variable,
);
const uncovered = KNOWN_CHANNELS.filter((c) => c.kind === "uncovered").map(
  (c) => c.variable,
);

describe("KNOWN_CHANNELS partitions the channel variables", () => {
  it("splits 28 into 25 minted and 3 uncovered", () => {
    expect(KNOWN_CHANNELS).toHaveLength(28);
    expect(minted).toHaveLength(25);
    expect(uncovered).toEqual([
      "--modifier-color-foreground-checkbox-unselected",
      "--modifier-color-foreground-radio-unselected",
      "--modifier-color-icon-on-foreground-secondary",
    ]);
  });

  it("keeps the two kinds disjoint", () => {
    expect(minted.filter((v) => uncovered.includes(v))).toEqual([]);
    // And no entry is listed twice under one kind either.
    expect(new Set(KNOWN_CHANNELS.map((c) => c.variable)).size).toBe(28);
  });

  it("unions to exactly the channel set the catalogue emits", () => {
    // A 29th channel, or a renamed one, fails here — in both directions, so
    // neither an addition to the build nor a stale entry in the list slips
    // through.
    expect([...minted, ...uncovered].sort()).toEqual(emitted);
  });

  it("marks as minted exactly what coverage derives", () => {
    // The claim the whole model rests on: S2's observed coverage predicts the
    // channel set. Recomputed from the resolver here, not read from s2.ttl, so
    // this compares the rule against the source rather than against its own
    // output.
    const resolver = JSON.parse(
      readFileSync(
        createRequire(import.meta.url).resolve(
          "@canonical/design-tokens/tokens/canonical/canonical.resolver.json",
        ),
        "utf8",
      ),
    );
    const derived = mintChannels(observedCoverage(loadSource(), resolver));
    expect(derived).toHaveLength(25);
    expect(minted.map((v) => channelSymbol(v, b.alg.symbols)).sort()).toEqual(
      derived.map((c) => c.name).sort(),
    );
  });

  it("bridges every minted channel and no uncovered one", () => {
    for (const variable of minted)
      expect(b.facts.get(variable)?.ofSymbol, variable).toBe(
        channelSymbol(variable, b.alg.symbols),
      );
    for (const variable of uncovered)
      expect(b.facts.get(variable)?.ofSymbol, variable).toBeNull();
  });

  it("refuses to guess a channel symbol", () => {
    // The inverse of the kebab rule is ambiguous, so it is a lookup against
    // the symbols S1 declares, and a tail that matches nothing throws rather
    // than producing an IRI that resolves to nothing.
    expect(() =>
      channelSymbol("--modifier-color-nonesuch", b.alg.symbols),
    ).toThrow(/0 symbols/);
  });
});

describe("the six laws", () => {
  it("L1 records every declaration, and one foreign property", () => {
    expect(findings.l1.declarations).toBe(1904);
    expect(findings.l1.files).toBe(11);
    // `color-scheme` is not a custom property, so no term holds it. Pinned so
    // a second foreign property is a decision rather than a surprise.
    expect(findings.l1.foreign).toEqual(["color-scheme"]);
  });

  it("L2 mints a distinct slug per condition", () => {
    expect(findings.l2.conditions).toBe(31);
    expect(findings.l2.slugs).toBe(findings.l2.conditions);
  });

  it("L3 joins every symbol-bearing declaration to a resolved value", () => {
    // Zero missing is the law. `matched` rose from 1,204 to 1,369 when the 25
    // channels gained dt:ofSymbol and S3 gained their 165 positions, and
    // `no-symbol` fell by the same 165.
    expect(findings.l3.missing).toBe(0);
    expect(findings.l3.declined).toBe(0);
    expect(findings.l3.matched).toBe(1369);
    expect(findings.l3.noSymbol).toBe(796);
    // The typography slots, PRA-157: artifact ids that are not symbols, so
    // they carry no dt:ofSymbol rather than a dangling IRI.
    expect(findings.l3.phantoms).toBe(187);
  });

  it("L4 names no coordinate S2 does not have", () => {
    expect(findings.l4.unknown).toEqual([]);
    expect(findings.l4.named).toBe(23);
  });

  it("L5 leaves no referenced variable outside the catalogue", () => {
    expect(findings.l5.dangling).toEqual([]);
  });

  it("L6 leaves 29 variables reaching no symbol, in two known populations", () => {
    expect(findings.l6.total).toBe(1156);
    expect(findings.l6.unreachable).toBe(29);
    expect(findings.l6.groups).toEqual({
      // 16 --delta-* lightness offsets: each is the value of a number.* symbol
      // the emitter baked in and dropped the link to. A producer fix.
      delta: 16,
      // 13 slots of a typography composite. PRA-157.
      typography: 13,
      // Every legacy twin reaches its own symbol, and nothing is unclassified.
      // Pinned at zero: these are the buckets a new orphan would land in.
      twins: 0,
      other: 0,
    });
    // And the two populations account for the whole of it.
    expect(Object.values(findings.l6.groups).reduce((a, n) => a + n, 0)).toBe(
      findings.l6.unreachable,
    );
  });
});

describe("the catalogue itself", () => {
  it("parses", () => {
    const parsed = new Parser({
      baseIRI: "https://dt.canonical.com/s4/web/",
    }).parse(b.ttl);
    expect(parsed.length).toBeGreaterThan(19000);
  });

  it("is what the committed file holds", () => {
    // The same claim CI's regenerate-and-diff makes, made here too, because
    // this one runs on every `bun test` and needs no workflow: a hand-edited
    // or stale stratum fails. This is S4's half of it; s1, s2 and s3 are
    // compared against the populator's return in populate.test.ts, so all
    // four strata are covered. `build()` returns the Turtle and only `main()`
    // writes it — the seam seam.test.ts pins — so asserting equality does not
    // itself rewrite the file.
    expect(readFileSync(join(PKG, "data/s4.web.ttl"), "utf8")).toBe(b.ttl);
  });
});

describe("the CSS the build emits, as this grammar reads it", () => {
  // The grammar is line-scoped, and the ADR's §3.4 asks for a multi-line
  // `var()` walker. The input says otherwise, and the input is emitted CSS,
  // not hand-written: these two cases measure it on every run, so the claim
  // "one line is enough" is a fact about this build rather than a memory of
  // one. If the emitter ever wraps a declaration or nests a rule inside a
  // rule, this is what goes red — and then the walker is worth writing.
  const files = cssFiles();
  const parsed = files.map((f) => parseCssText(f, readCss(f)));

  it("wraps no declaration, and reaches no line it cannot read", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(parsed.flatMap((p) => p.ignored)).toEqual([]);
    // And the accounting is real: every declaration in the catalogue came
    // from one of these lines.
    expect(parsed.reduce((n, p) => n + p.declarations.length, 0)).toBe(
      findings.l1.declarations,
    );
  });

  it("nests only at-rules, never a rule inside a rule", () => {
    // A selector nested inside a selector would arrive in `atRules`, where
    // the slug would read it as a condition prelude and the two selectors
    // would be lost. Every prelude but the innermost is an at-rule today.
    const nested = parsed
      .flatMap((p) => p.declarations)
      .flatMap((d) => d.condition.atRules)
      .filter((prelude) => !prelude.startsWith("@"));
    expect([...new Set(nested)]).toEqual([]);
  });

  it("refuses a custom property it cannot read, rather than dropping it", () => {
    // The silent drop this replaces cost a declaration, its dt:references,
    // its L5 edge and its L6 reachability edge, and left only a declaration
    // count as the tripwire.
    expect(() =>
      parseCssText(
        "wrapped.css",
        [
          ":root {",
          "  --color-text: var(--color-palette-neutral-900),",
          "}",
        ].join("\n"),
      ),
    ).toThrow(/wrapped\.css:2: a custom property this grammar cannot read/);
  });

  it("names any other line it passed over", () => {
    // Not every unreadable line is a lost triple — an at-statement is not a
    // declaration — so those are collected rather than thrown on, and the
    // collection is what the first case asserts is empty over `dist/`.
    const { ignored, declarations } = parseCssText(
      "odd.css",
      ['@charset "utf-8";', ":root {", "  --color-text: red;", "}"].join("\n"),
    );
    expect(ignored).toEqual(['odd.css:1: @charset "utf-8";']);
    expect(declarations).toHaveLength(1);
  });

  it("reads a declaration under stacked at-rules", () => {
    const { declarations, foreign, ignored } = parseCssText(
      "sample.css",
      [
        "/* a comment line */",
        "@layer ds-modifiers {",
        "  @media (prefers-color-scheme: dark) {",
        "    :root {",
        "      --color-text: var(--color-palette-neutral-100);",
        "      color-scheme: dark;",
        "    }",
        "  }",
        "}",
      ].join("\n"),
    );
    expect(ignored).toEqual([]);
    expect(declarations).toEqual([
      {
        variable: "--color-text",
        condition: {
          atRules: [
            "@layer ds-modifiers",
            "@media (prefers-color-scheme: dark)",
          ],
          selector: ":root",
          slug: "layer-ds-modifiers/media-prefers-color-scheme-dark/root",
        },
        value: "var(--color-palette-neutral-100)",
        file: "sample.css",
        line: 5,
      },
    ]);
    expect(foreign).toEqual([
      { property: "color-scheme", file: "sample.css", line: 6 },
    ]);
  });
});

describe("the variables a value names", () => {
  it("names every var() in the order written", () => {
    expect(references("var(--modifier-color-text, var(--color-text))")).toEqual(
      ["--modifier-color-text", "--color-text"],
    );
    expect(references("light-dark(var(--color-a), var(--color-b))")).toEqual([
      "--color-a",
      "--color-b",
    ]);
  });

  it("names nothing in a literal, and nothing in a bare fallback", () => {
    expect(references("oklch(97.9% 0.0041 337.35)")).toEqual([]);
    // `var(` is the trigger, so a bare name in a fallback position is not a
    // reference — which is right: it is not a reference in CSS either.
    expect(references("var(--color-text, red)")).toEqual(["--color-text"]);
  });

  it("is what the catalogue asserts dt:references from", () => {
    // Not a restatement: this ties the exported function to the emitted
    // triples, so a change to one without the other fails.
    const declaration = b.byVariable
      .get("--modifier-color-text")
      ?.find((d) => d.value.includes("var("));
    expect(declaration).toBeDefined();
    for (const variable of references(declaration?.value as string))
      expect(b.ttl).toContain(`<${variable}>`);
  });
});

describe("the two spellings a symbol can carry", () => {
  /**
   * S4 gives 204 of the 716 symbols that have a variable TWO variables — the
   * kebab-case name and the camelCase legacy name the build still emits — and
   * nothing in the graph marks either one canonical. ADR §3.4 assigns that
   * rule to J-1 and §3.7's row X9 records it as settled; it is neither, and it
   * cannot be settled here, because saying "this spelling is the canonical
   * one" needs a term to say it with and `dt:channelOf` is the only new term
   * this branch is allowed. So the obligation is CARRIED, not met, and the ADR
   * has to say so.
   *
   * What can be settled without vocabulary is the size and the harmlessness
   * of the drift, and that is what this pins: the twins are exactly these 204
   * pairs, each pair is one name in two spellings, and the two spellings
   * answer with the same value. So a query that asks "the variable for symbol
   * X on web" gets two rows for 204 symbols and both rows are right — a
   * consumer that cannot choose is inconvenienced, never misinformed. A 205th
   * pair, or a pair whose two spellings disagree, fails here.
   */
  const bySymbol = new Map<string, string[]>();
  for (const [variable, f] of b.facts) {
    if (!f.ofSymbol) continue;
    bySymbol.set(f.ofSymbol, [...(bySymbol.get(f.ofSymbol) ?? []), variable]);
  }
  const histogram = new Map<number, number>();
  for (const variables of bySymbol.values())
    histogram.set(variables.length, (histogram.get(variables.length) ?? 0) + 1);
  const pairs = [...bySymbol].filter(([, v]) => v.length === 2);

  it("gives 204 of the 716 symbols with a variable exactly two", () => {
    expect(bySymbol.size).toBe(716);
    expect(Object.fromEntries([...histogram].sort())).toEqual({
      1: 512,
      2: 204,
    });
  });

  it("makes every pair one name in two spellings", () => {
    // Not two platform names for one symbol: the camelCase one is the kebab
    // one's twin under the build's own naming rule, which is why kebabTwin is
    // enough to relate them and no third spelling is possible.
    const odd = pairs.filter(([, variables]) => {
      const camel = variables.find((v) => kebabTwin(v) !== v);
      const kebab = variables.find((v) => kebabTwin(v) === v);
      return !camel || !kebab || kebabTwin(camel) !== kebab;
    });
    expect(odd).toEqual([]);
  });

  it("makes both spellings answer with the same value", () => {
    // Either verbatim the same value, or the legacy spelling aliasing the
    // kebab one in a single var() hop — which is the same value once
    // resolved. Anything else would be a real divergence between two names
    // for one symbol, and there is none.
    const kinds = { identical: 0, alias: 0, other: [] as string[] };
    for (const [symbol, variables] of pairs) {
      const camel = variables.find((v) => kebabTwin(v) !== v) as string;
      const kebab = variables.find((v) => kebabTwin(v) === v) as string;
      const cd = b.byVariable.get(camel) ?? [];
      const kd = b.byVariable.get(kebab) ?? [];
      if (cd.length !== 1 || kd.length !== 1) kinds.other.push(symbol);
      else if (cd[0].value === `var(${kebab})`) kinds.alias += 1;
      else if (cd[0].value === kd[0].value) kinds.identical += 1;
      else kinds.other.push(`${symbol}: ${cd[0].value} vs ${kd[0].value}`);
    }
    expect(kinds).toEqual({ identical: 172, alias: 32, other: [] });
  });
});

/**
 * The channels: what is minted, what they are worth, and what they are called.
 *
 * Everything here is asserted off the values the populator RETURNS, not off
 * the committed `data/`. A test that reads the file it is meant to guard
 * passes on a hand-edited file, which is the failure this package exists to
 * prevent — and it also passes on a stale file, which is how the catalogue
 * came to carry ten declarations the build had stopped emitting.
 *
 * The one thing read from disk is `data/s4.web.ttl`, and it is read as an
 * INPUT: the channel routing is the platform's own, and reading it is the
 * derivation, not a shortcut around it.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "n3";
import { describe, expect, it } from "vitest";
import {
  type Channel,
  type ChannelRouting,
  mintChannels,
  populate,
  resolveChannels,
} from "./populate.js";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DT = "https://dt.canonical.com/";
const A = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const built = populate();
const channels = built.channels;
const resolution = built.s3.counts.channels;

/** The rows for one channel at one coordinate — at most one, by the shape. */
const at = (channel: string, coordinate: string): ChannelRouting[] =>
  resolution.routings.filter(
    (r) => r.channel === channel && r.coordinate === coordinate,
  );

describe("the channels minted from coverage", () => {
  it("mints one per (rung, covered symbol) — 9 modifier, 16 surface", () => {
    expect(channels).toHaveLength(25);
    expect(channels.filter((c) => c.kind === "modifier")).toHaveLength(9);
    expect(channels.filter((c) => c.kind === "surface")).toHaveLength(16);
  });

  it("mints nothing for the shell rung, and nothing uncovered", () => {
    // The theme family covers 354 symbols and sits at dt:level.shell, so if
    // the rung filter ever went, the channel count would jump by hundreds.
    // Read off the coverage the populator itself computed, not a remembered
    // number.
    const mode = built.coverage.find((c) => c.axis === "theme");
    expect(mode?.symbols.length).toBeGreaterThan(300);
    expect(channels.filter((c) => c.name.startsWith("theme."))).toEqual([]);
    // The three channel variables the build emits without coverage behind
    // them are not symbols. Their base symbols exist; no family covers them.
    for (const uncovered of [
      "modifier.color.foreground.checkbox.unselected",
      "modifier.color.foreground.radio.unselected",
      "modifier.color.icon.onForegroundSecondary",
    ])
      expect(channels.map((c) => c.name)).not.toContain(uncovered);
  });

  it("names the symbol each channel provisions", () => {
    const text = channels.find((c) => c.name === "modifier.color.text");
    expect(text).toEqual({
      name: "modifier.color.text",
      of: "color.text",
      kind: "modifier",
    });
    // Every channel's base symbol is a symbol S1 declares — a channel of a
    // name that is not a symbol would be a channel of nothing.
    const s1 = new Set(
      new Parser({ baseIRI: `${DT}file/` })
        .parse(readFileSync(join(PKG, "data/s1.ttl"), "utf8"))
        .filter(
          (q) =>
            q.predicate.value === A && q.object.value === `${DT}TokenSymbol`,
        )
        .map((q) => decodeURIComponent(q.subject.value.slice(DT.length))),
    );
    expect(channels.filter((c) => !s1.has(c.of))).toEqual([]);
  });

  it("mints deterministically, in sorted order", () => {
    expect(channels.map((c) => c.name)).toEqual(
      [...channels.map((c) => c.name)].sort(),
    );
    expect(mintChannels(built.coverage).map((c) => c.name)).toEqual(
      channels.map((c) => c.name),
    );
  });
});

describe("the routings the channels carry", () => {
  it("holds one node per (channel x coordinate) pair — 165, not 330", () => {
    expect(resolution.routings).toHaveLength(165);
    // S3's total: 718 at the all-defaults position, 354 at mode.dark, 165 on
    // the channels. It was 1,402 while every channel row also carried a copy
    // of its target's value and so needed a second row per mode; a routing
    // holds no value, so the mode row has nothing to say and is gone.
    expect(
      built.s3.counts.base + built.s3.counts.dark + resolution.routings.length,
    ).toBe(1237);
  });

  it("invents nothing where the platform routes nowhere", () => {
    // Each of these is a measurement the derivation reports rather than a
    // value it makes up. All three are zero today; a non-zero one is a real
    // finding, and pinning them at zero is what surfaces it.
    expect(resolution.unrouted).toEqual([]);
    expect(resolution.unresolved).toEqual([]);
    expect(resolution.unemitted).toEqual([]);
  });

  it("carries exactly one coordinate, and never a mode", () => {
    // The invariant, asserted as a shape rather than trusted as a habit: a
    // derived routing carries exactly the coordinates its own declaration
    // selects, never a product of families. 36 coordinates over 9 families
    // make a materialised cross-product explode, and the only thing standing
    // between this graph and one is this. A row gaining a second coordinate
    // fails here, whichever family it came from.
    expect(
      resolution.routings.filter((r) => r.coordinate.split(".").length !== 2),
    ).toEqual([]);
    const families = new Set(
      resolution.routings.map((r) => r.coordinate.split(".")[0]),
    );
    expect(families.has("mode")).toBe(false);
    // And the pairs are distinct: one node per pair, not two.
    const pairs = new Set(
      resolution.routings.map((r) => `${r.channel}@${r.coordinate}`),
    );
    expect(pairs.size).toBe(resolution.routings.length);
  });

  it("says nothing at a neutral position", () => {
    // Seven families have a `<family>.none` coordinate. A channel with a
    // neutral value would be a semantic token; the absence is what
    // var(--modifier-color-text, var(--color-text)) says on the page.
    const neutral = resolution.routings.filter((r) =>
      r.coordinate.endsWith(".none"),
    );
    expect(neutral).toEqual([]);
  });

  it("carries a symbol the platform routes to, per family", () => {
    // One case per covering family, each a routing the naming rule this model
    // first proposed gets wrong — which is why the routing is read out of the
    // catalogue. `lifecycle.planned` is the plainest: it routes to the
    // criticality ramp's `information`, and no `color.text.planned` exists.
    const routes: [string, string, string][] = [
      ["modifier.color.text", "anticipation.caution", "color.text.warning"],
      [
        "modifier.color.text",
        "criticality.information",
        "color.text.information",
      ],
      ["modifier.color.text", "emphasis.muted", "color.text.muted"],
      ["modifier.color.text", "lifecycle.planned", "color.text.information"],
      ["modifier.color.text", "release.stable", "color.text.success"],
      ["surface.color.background", "surface.layer2", "color.background.layer2"],
    ];
    for (const [channel, coordinate, derivedFrom] of routes) {
      const rows = at(channel, coordinate);
      expect(rows.length, `${channel} @ ${coordinate}`).toBe(1);
      expect(rows[0].derivedFrom, `${channel} @ ${coordinate}`).toBe(
        derivedFrom,
      );
    }
  });

  it("counts the pairs each family provisions", () => {
    const byFamily = new Map<string, number>();
    for (const r of resolution.routings) {
      const family = r.coordinate.split(".")[0];
      byFamily.set(family, (byFamily.get(family) ?? 0) + 1);
    }
    expect(Object.fromEntries([...byFamily].sort())).toEqual({
      anticipation: 18,
      criticality: 30,
      emphasis: 9,
      lifecycle: 16,
      release: 16,
      surface: 76,
    });
  });

  it("carries derivedFrom, and neither a value nor a route", () => {
    // The shape makes the two branches an sh:xone with sh:maxCount 0 on
    // dt:resolvesTo in the derived one, so this is not a preference: a route
    // begins with the definition that won for the symbol and a channel is
    // authored nowhere, and a value here would be a second copy of the
    // target's, free to drift from it.
    expect(built.s3.ttl).toContain(
      [
        "[]",
        "    a dt:ResolvedValue ;",
        "    dt:forSymbol dt:modifier.color.text ;",
        "    dt:coordinate dt:coordinate.anticipation.constructive ;",
        "    dt:derivedFrom dt:color.text.constructive .",
      ].join("\n"),
    );
    for (const block of built.s3.ttl.split(/\n\n+/)) {
      if (!block.includes("dt:derivedFrom")) continue;
      expect(block).not.toContain("dt:resolutionChain");
      expect(block).not.toContain("dt:resolvesTo");
      expect(block).not.toContain("dt:coordinate.mode.");
    }
  });
});

describe("the value of a channel at a position, as a consumer reads it", () => {
  /**
   * The walk the whole shape exists to make possible, done here the way a
   * consumer will do it and not the way the generator wrote it: start from the
   * channel symbol and the coordinate, follow dt:derivedFrom ONE hop to the
   * target symbol, and read that symbol's own resolved value at the mode you
   * want. The channel node holds no value, so this is the only way to get one
   * — and the target's dark value is the channel's dark value by construction.
   *
   * Read off the parsed graph, not off the row objects: a consumer has quads.
   */
  const quads = new Parser({ baseIRI: `${DT}file/` }).parse(built.s3.ttl);
  const local = (iri: string): string =>
    decodeURIComponent(iri.slice(DT.length));
  const forSymbol = new Map<string, string>();
  const coordinates = new Map<string, string[]>();
  const derivedFrom = new Map<string, string>();
  const resolvesTo = new Map<string, string>();
  for (const q of quads) {
    const node = q.subject.value;
    switch (q.predicate.value) {
      case `${DT}forSymbol`:
        forSymbol.set(node, local(q.object.value));
        break;
      case `${DT}coordinate`:
        coordinates.set(node, [
          ...(coordinates.get(node) ?? []),
          local(q.object.value),
        ]);
        break;
      case `${DT}derivedFrom`:
        derivedFrom.set(node, local(q.object.value));
        break;
      case `${DT}resolvesTo`:
        resolvesTo.set(node, q.object.value);
        break;
    }
  }

  /** The nodes for one symbol whose coordinate set is exactly `want`. */
  const nodesAt = (symbol: string, want: string[]): string[] =>
    [...forSymbol]
      .filter(([node, s]) => {
        if (s !== symbol) return false;
        const have = (coordinates.get(node) ?? []).sort();
        return (
          have.length === want.length && have.every((c, i) => c === want[i])
        );
      })
      .map(([node]) => node);

  /**
   * A symbol's own value at a mode. S3's convention for the light position is
   * the ABSENCE of a mode coordinate, so `mode.light` is the node with no
   * coordinate at all — which is what a consumer asking for the light value
   * has to know, and is stated in the stratum's header.
   */
  const valueAt = (symbol: string, mode: "light" | "dark"): unknown => {
    const nodes = nodesAt(
      symbol,
      mode === "dark" ? ["coordinate.mode.dark"] : [],
    );
    expect(nodes, `${symbol} at mode.${mode}`).toHaveLength(1);
    const raw = resolvesTo.get(nodes[0]);
    expect(raw, `${symbol} at mode.${mode}`).toBeDefined();
    return JSON.parse(raw as string);
  };

  it("reaches both goldens from the channel and the coordinate, in one hop", () => {
    const channel = nodesAt("modifier.color.text", [
      "coordinate.anticipation.constructive",
    ]);
    expect(channel).toHaveLength(1);
    // The node the consumer starts from holds no value of its own: without
    // this the walk below could be reading a copy and agreeing with itself.
    expect(resolvesTo.has(channel[0])).toBe(false);

    const target = derivedFrom.get(channel[0]);
    expect(target).toBe("color.text.constructive");

    expect(valueAt(target as string, "light")).toEqual({
      colorSpace: "oklch",
      components: [0.5, 0.1355, 143.96],
    });
    expect(valueAt(target as string, "dark")).toEqual({
      colorSpace: "oklch",
      components: [0.6405, 0.1743, 144.01],
    });
  });

  it("reads the same two values whichever mode the routing was asked for", () => {
    // The mode coordinate is gone from the channel node, and this is why that
    // costs nothing: the routing is the same in either mode, so one node
    // answers both. A channel whose routing DID differ by mode would need the
    // coordinate back, and would show up as a second node here.
    expect(
      nodesAt("modifier.color.text", [
        "coordinate.anticipation.constructive",
        "coordinate.mode.dark",
      ]),
    ).toEqual([]);
  });
});

describe("the labels", () => {
  // Three assertions, and the third is the one that lets a consumer treat the
  // symbol labels and the variable labels as one name space.
  const labelled = (ttl: string, predicate: string): Map<string, string> => {
    const out = new Map<string, string>();
    for (const q of new Parser({ baseIRI: `${DT}${predicate}` }).parse(ttl)) {
      if (q.predicate.value !== "http://www.w3.org/2000/01/rdf-schema#label")
        continue;
      out.set(q.subject.value, q.object.value);
    }
    return out;
  };
  const symbolLabels = new Map([
    ...labelled(built.s1, "file/"),
    ...labelled(built.s2, "file/"),
  ]);
  const variableLabels = labelled(
    readFileSync(join(PKG, "data/s4.web.ttl"), "utf8"),
    "s4/web/",
  );

  it("labels all 745 symbols with their dotted name", () => {
    expect(symbolLabels.size).toBe(745);
    for (const [iri, label] of symbolLabels)
      expect(label).toBe(decodeURIComponent(iri.slice(DT.length)));
  });

  it("labels all 1,156 variables with the name minus the leading dashes", () => {
    expect(variableLabels.size).toBe(1156);
    for (const [iri, label] of variableLabels)
      expect(`--${label}`).toBe(
        decodeURIComponent(iri.slice(`${DT}s4/web/`.length)),
      );
  });

  it("has no duplicate variable label, no hyphen in a symbol label, and no overlap", () => {
    const variables = [...variableLabels.values()];
    expect(new Set(variables).size).toBe(variables.length);
    expect([...symbolLabels.values()].filter((s) => s.includes("-"))).toEqual(
      [],
    );
    const symbols = new Set(symbolLabels.values());
    expect(variables.filter((v) => symbols.has(v))).toEqual([]);
  });
});

describe("the committed strata are what the populator returns", () => {
  // catalogue.test.ts makes this claim for s4.web.ttl, and nothing made it
  // for the other three: a hand-edited symbol label in s1, a deleted
  // dt:channelOf in s2 or a changed channel value in s3 left the whole suite
  // green, with CI's regenerate-and-diff the only detector. `populate()`
  // returns all three as strings, so the same claim is made here, where it
  // runs on every `bun test`. Reading the file is safe: nothing in this
  // package writes `data/` outside a script's own `main()`, which seam.test.ts
  // pins.
  it.each([
    ["data/s1.ttl", () => built.s1],
    ["data/s2.ttl", () => built.s2],
    ["data/s3.ttl", () => built.s3.ttl],
  ])("%s", (rel, generated) => {
    expect(readFileSync(join(PKG, rel), "utf8")).toBe(generated());
  });
});

describe("dt:channelOf, in the committed graph", () => {
  // The triple the whole stratum turns on, asserted directly rather than
  // through a count: what a channel IS is dt:channelOf, so a channel that
  // lost it would still be a dt:TokenSymbol with a label and a value, and
  // every other assertion in this file would pass.
  const quads = ["data/s1.ttl", "data/s2.ttl"].flatMap((rel) =>
    new Parser({ baseIRI: `${DT}file/` }).parse(
      readFileSync(join(PKG, rel), "utf8"),
    ),
  );
  const local = (iri: string): string =>
    decodeURIComponent(iri.slice(DT.length));
  const symbols = new Set(
    quads
      .filter(
        (q) => q.predicate.value === A && q.object.value === `${DT}TokenSymbol`,
      )
      .map((q) => local(q.subject.value)),
  );
  const channelOf = new Map<string, string[]>();
  for (const q of quads) {
    if (q.predicate.value !== `${DT}channelOf`) continue;
    const subject = local(q.subject.value);
    channelOf.set(subject, [
      ...(channelOf.get(subject) ?? []),
      local(q.object.value),
    ]);
  }

  it("names the base symbol of each of the 25 channels, once", () => {
    expect(channelOf.size).toBe(25);
    expect([...channelOf].filter(([, of]) => of.length !== 1)).toEqual([]);
    // Exactly the channels coverage mints — the committed triples against the
    // rule, not against their own re-emission.
    expect([...channelOf.keys()].sort()).toEqual(
      channels.map((c) => c.name).sort(),
    );
    expect([...channelOf].map(([name, of]) => [name, of[0]]).sort()).toEqual(
      channels.map((c) => [c.name, c.of]).sort(),
    );
  });

  it("points only at symbols, and only from symbols", () => {
    // A channel of something that is not a symbol is a channel of nothing,
    // and dt:channelOf carries no rdfs:domain, so nothing else checks this.
    for (const [name, of] of channelOf) {
      expect(symbols.has(name), name).toBe(true);
      expect(symbols.has(of[0]), of[0]).toBe(true);
    }
  });
});

describe("the three reports, driven", () => {
  /**
   * `unrouted`, `unresolved` and `unemitted` are pinned empty above, and all
   * three producing branches were unexecuted: an empty corpus and a broken
   * detector look identical from there. `resolveChannels` takes the catalogue
   * Turtle as an injectable third argument for exactly this, so each branch is
   * driven here with a synthetic catalogue small enough to read.
   *
   * The Turtle is the shape catalogue.ts writes — variables as relative IRIs
   * against the S4 base, declarations as blank nodes under a condition — so
   * these fixtures exercise the same parse the real file does.
   */
  const catalogue = (body: string): string =>
    `@prefix dt: <${DT}> .
@base <${DT}s4/web/> .

<cond/local>
    a dt:Condition ;
    dt:selectsCoordinate dt:coordinate.anticipation.constructive .

<cond/root>
    a dt:Condition .

${body}`;

  const channel: Channel = {
    name: "modifier.color.text",
    of: "color.text",
    kind: "modifier",
  };
  const declares = (variable: string, condition: string, refs?: string) =>
    `<${variable}>
    a dt:Variable ;
    dt:declaredAt [
        a dt:Declaration ;
        dt:under <cond/${condition}>${refs ? ` ;\n        dt:references ( <${refs}> )` : ""} ] .`;
  const target = (variable: string, symbol?: string) =>
    `<${variable}> a dt:Variable${symbol ? ` ; dt:ofSymbol dt:${symbol}` : ""} .`;

  it("reports a channel the catalogue declares no variable for", () => {
    const r = resolveChannels(
      [channel],
      new Set(),
      catalogue(declares("--something-else", "local")),
    );
    expect(r.unemitted).toEqual(["modifier.color.text"]);
    expect(r.routings).toEqual([]);
  });

  it("reports a declaration whose references reach no symbol", () => {
    // One hop and no further: the reference exists, carries no dt:ofSymbol,
    // and nothing downstream of it is followed. The channel is not given the
    // referenced variable's own name, or any other guess.
    const r = resolveChannels(
      [channel],
      new Set(),
      catalogue(
        `${declares("--modifier-color-text", "local", "--color-text")}\n${target("--color-text")}`,
      ),
    );
    expect(r.unrouted).toEqual([
      "modifier.color.text @ anticipation.constructive",
    ]);
    expect(r.routings).toEqual([]);
  });

  it("reports a routed symbol the graph holds no value for", () => {
    const r = resolveChannels(
      [channel],
      new Set(),
      catalogue(
        `${declares("--modifier-color-text", "local", "--color-text-constructive")}\n${target("--color-text-constructive", "color.text.constructive")}`,
      ),
    );
    expect(r.unresolved).toEqual([
      "modifier.color.text @ anticipation.constructive → color.text.constructive",
    ]);
    expect(r.routings).toEqual([]);
  });

  it("says nothing about a channel the platform declares at no coordinate", () => {
    // A variable declared only under a condition that selects nothing is not
    // unrouted — there is no position to route AT. Silence is the right
    // report, and this is the case that proves the silence is deliberate.
    const r = resolveChannels(
      [channel],
      new Set(),
      catalogue(declares("--modifier-color-text", "root", "--color-text")),
    );
    expect(r).toMatchObject({
      routings: [],
      unrouted: [],
      unresolved: [],
      unemitted: [],
    });
  });

  it("resolves the same fixture once S3 holds the symbol", () => {
    // The positive control: with the routed symbol held the three reports stay
    // empty and the row appears, so the cases above fail for the reason they
    // claim rather than because the fixture routes nowhere at all. One row,
    // not two: the row carries no value, so there is no second mode of it.
    const r = resolveChannels(
      [channel],
      new Set(["color.text.constructive"]),
      catalogue(
        `${declares("--modifier-color-text", "local", "--color-text-constructive")}\n${target("--color-text-constructive", "color.text.constructive")}`,
      ),
    );
    expect(r.routings).toEqual([
      {
        channel: "modifier.color.text",
        coordinate: "anticipation.constructive",
        derivedFrom: "color.text.constructive",
      },
    ]);
    expect([r.unrouted, r.unresolved, r.unemitted]).toEqual([[], [], []]);
  });
});

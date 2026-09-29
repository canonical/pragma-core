import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Parser } from "n3";
import { describe, expect, it } from "vitest";
import { parseAnatomyYAML } from "./parse.js";
import { STYLE_KEYS } from "./registry.generated.js";
import type { Node, Style, Switch } from "./types.js";

const DT = "https://dt.canonical.com/";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const EXAMPLES = resolve(import.meta.dirname, "..", "examples", "yaml");

/**
 * Every symbol the token graph declares: S1's authored symbols and S2's
 * minted channels. Read from the pinned `@canonical/token-ontology`, resolved
 * from the package and never by a path into node_modules.
 *
 * NOTE the package is linked to J-1's worktree until 0.11.0 publishes — the
 * channels this corpus consumes exist only there.
 */
function tokenSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const stratum of ["s1.ttl", "s2.ttl"]) {
    const path = new URL(
      import.meta.resolve(`@canonical/token-ontology/data/${stratum}`),
    ).pathname;
    for (const quad of new Parser().parse(readFileSync(path, "utf8"))) {
      if (
        quad.predicate.value === RDF_TYPE &&
        quad.object.value === `${DT}TokenSymbol`
      ) {
        symbols.add(quad.subject.value.slice(DT.length));
      }
    }
  }
  return symbols;
}

const symbols = tokenSymbols();

function styles(node: Node | Switch, out: Style[] = []): Style[] {
  if ("discriminator" in node) {
    for (const kase of node.cases) styles(kase.node, out);
    return out;
  }
  out.push(...(node.styles ?? []));
  for (const edge of node.edges ?? []) styles(edge.target, out);
  return out;
}

const corpus = readdirSync(EXAMPLES)
  .filter((f) => f.endsWith(".anatomy.yaml"))
  .sort()
  .map((file) => ({
    file,
    styles: styles(
      parseAnatomyYAML(readFileSync(resolve(EXAMPLES, file), "utf8")).root,
    ),
  }));

const allStyles = corpus.flatMap((c) => c.styles);
const usedSymbols = [...new Set(allStyles.flatMap((s) => s.symbols))].sort();

describe("the nine examples as corpus", () => {
  it("is nine anatomies that parse under the value grammar", () => {
    expect(corpus).toHaveLength(9);
    expect(allStyles.length).toBeGreaterThan(60);
  });

  it("binds only keys the registry's roster holds", () => {
    for (const { file, styles: bindings } of corpus) {
      for (const binding of bindings) {
        expect(
          STYLE_KEYS[binding.key],
          `${file}: ${binding.key}`,
        ).toBeDefined();
      }
    }
  });

  it("resolves every symbol it consumes, in S1 or S2", () => {
    expect(usedSymbols.length).toBeGreaterThan(30);
    for (const symbol of usedSymbols) {
      expect(symbols.has(symbol), symbol).toBe(true);
    }
  });

  it("fails on a symbol the graph does not declare", () => {
    // The check above is only worth having if it can go red: a name of the
    // right shape that no stratum declares must not resolve.
    expect(symbols.has("color.text")).toBe(true);
    expect(symbols.has("color.text.nosuchthing")).toBe(false);
    expect(symbols.has("modifier.surface")).toBe(false);
  });

  it("keeps every symbol inside its key's tokenNamespace", () => {
    for (const { file, styles: bindings } of corpus) {
      for (const binding of bindings) {
        const entry = STYLE_KEYS[binding.key];
        for (const symbol of binding.symbols) {
          expect(
            entry?.tokenNamespace.some((ns) => symbol.startsWith(ns)),
            `${file}: ${symbol} on ${binding.key}`,
          ).toBe(true);
        }
      }
    }
  });

  it("puts a symbol only where the key admits one, and always where it must", () => {
    for (const { file, styles: bindings } of corpus) {
      for (const binding of bindings) {
        const kind = STYLE_KEYS[binding.key]?.valueKind;
        if (kind === "primitive") {
          expect(binding.symbols, `${file}: ${binding.key}`).toEqual([]);
        }
        if (kind === "token") {
          expect(
            binding.symbols.length,
            `${file}: ${binding.key}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("carries the fallback chains the reference has, and the literal tails", () => {
    const button = corpus.find((c) => c.file.startsWith("stateful-button"));
    const iconColour = button?.styles.find(
      (s) =>
        s.key === "typography.color" && s.value.includes("modifier.color.icon"),
    );
    // Button's icon slot: two channels, then currentColor. The tail is in the
    // authored value and in none of the symbols.
    expect(iconColour?.value).toBe(
      "[modifier.color.icon, modifier.color.text, currentColor]",
    );
    expect(iconColour?.symbols).toEqual([
      "modifier.color.icon",
      "modifier.color.text",
    ]);
    const ring = button?.styles.find(
      (s) => s.key === "appearance.outline.color" && s.state === "focus",
    );
    expect(ring?.symbols).toEqual([
      "modifier.color.focusRing",
      "color.focusRing",
    ]);
  });

  it("holds a quoted literal that a bare YAML would read as something else", () => {
    const card = corpus.find((c) => c.file.startsWith("card"));
    const line = card?.styles.find((s) => s.value === "1 / -1");
    expect(line?.key).toBe("layout.grid.column");
    expect(line?.symbols).toEqual([]);
  });
});

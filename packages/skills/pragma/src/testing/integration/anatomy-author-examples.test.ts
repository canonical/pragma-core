/**
 * The `anatomy-author` skill's examples, checked against the graph they teach.
 *
 * The skill is how an author learns the notation, so an example carrying a retired
 * path, a key outside the roster or a symbol no stratum declares teaches the wrong
 * thing — and nothing else in this repository would notice. This suite reads the
 * skill's own YAML blocks and holds them to the rules the derivation enforces:
 *
 *   - no retired notation: no slash path, no `?` marker;
 *   - every style key in the published roster;
 *   - every symbol-shaped element resolves in S1 or S2 — a name no stratum declares
 *     is never written, it is recorded in a `#` comment on the line.
 *
 * A block with a `{placeholder}` is a template rather than an anatomy, and is checked
 * for the retired notation only: it does not parse as a document and is not meant to.
 */
import { readFileSync } from "node:fs";
import { STYLE_KEYS } from "@canonical/anatomy-dsl";
// design-system publishes no entry for these two, so they resolve only in this workspace,
// which is the only place this test runs.
import { RETIRED_PATH } from "@canonical/design-system/src/anatomies/validate.js";
import { loadSymbolIndex } from "@canonical/design-system/src/transform/symbols.js";
import { describe, expect, it } from "vitest";
import { isMap, isScalar, isSeq, parseDocument, type Scalar } from "yaml";

const SKILL = "skills/anatomy-author/SKILL.md";
const FILES = [SKILL, "skills/anatomy-author/ANATOMY_DSL_SPEC.md"];

/** Read a file by its path from the package root, wherever the runner started. */
function readPackageFile(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf-8");
}

/** Every fenced YAML block in a document, with the line it starts on. */
function findYamlBlocks(path: string): Array<{ line: number; body: string }> {
  const lines = readPackageFile(path).split("\n");
  const blocks: Array<{ line: number; body: string }> = [];
  let start: number | null = null;
  let body: string[] = [];
  lines.forEach((line, index) => {
    if (start === null && /^```ya?ml\s*$/.test(line.trim())) {
      start = index + 1;
      body = [];
      return;
    }
    if (start !== null && line.trim() === "```") {
      blocks.push({ line: start, body: body.join("\n") });
      start = null;
      return;
    }
    if (start !== null) {
      body.push(line);
    }
  });
  return blocks;
}

/** One style binding found in an example. */
interface Binding {
  where: string;
  key: string;
  elements: string[];
  comment: string;
}

/** Every style binding in one block, or null when the block is not a document. */
function findBindings(
  path: string,
  block: { line: number; body: string },
): Binding[] | null {
  // Three shapes that are not documents: a template's `{Placeholder}`, a schematic
  // ellipsis (`styles: { ... }`), and a fragment listing a key's alternatives
  // (`center | left`), which is prose in a code fence.
  if (
    /\{[A-Za-z]/.test(block.body) ||
    /\.\.\./.test(block.body) ||
    /:\s.*\s\|\s/.test(block.body)
  ) {
    return null;
  }
  const document = parseDocument(block.body);
  if (document.errors.length > 0) {
    return null;
  }
  const found: Binding[] = [];
  const walk = (value: unknown): void => {
    if (isSeq(value)) {
      for (const item of value.items) {
        walk(item);
      }
      return;
    }
    if (!isMap(value)) {
      return;
    }
    for (const pair of value.items) {
      const key = String((pair.key as Scalar).value);
      if (key !== "styles") {
        walk(pair.value);
        continue;
      }
      if (!isMap(pair.value)) {
        continue;
      }
      for (const style of pair.value.items) {
        const raw = style.value;
        const elements = isSeq(raw)
          ? raw.items.map((entry) => String((entry as Scalar).value))
          : [String(isScalar(raw) ? (raw as Scalar).value : raw)];
        found.push({
          where: `${path}:${block.line}`,
          key: String((style.key as Scalar).value),
          elements,
          comment: String(
            (raw as { comment?: string })?.comment ??
              (style as { comment?: string }).comment ??
              "",
          ),
        });
      }
    }
  };
  walk(document.contents);
  return found;
}

const blocks = FILES.flatMap((path) =>
  findYamlBlocks(path).map((block) => ({ path, block })),
);
const bindings = blocks.flatMap(
  ({ path, block }) => findBindings(path, block) ?? [],
);

describe("the anatomy-author skill's examples", () => {
  it("finds the examples to check, so the suite is not vacuous", () => {
    expect(blocks.length).toBeGreaterThan(20);
    expect(bindings.length).toBeGreaterThan(40);
  });

  it("carries no retired path notation anywhere in the skill", () => {
    // Not just in the parseable blocks: the prose, the tables and the templates too.
    // A reader copies what they see.
    const offences: string[] = [];
    for (const path of FILES) {
      const lines = readPackageFile(path).split("\n");
      lines.forEach((line, index) => {
        // The spec has to be able to SHOW what is rejected, so a line the text
        // itself marks as rejected is the one place the retired form may appear.
        if (
          lines
            .slice(Math.max(0, index - 3), index)
            .some((previous) => /Rejected/i.test(previous))
        ) {
          return;
        }
        // Only the value half of a `key: value` line, so a URL in prose is not a
        // token path and is not treated as one.
        const value = /^\s*[-*]?\s*"?[a-z][\w.@]*"?\s*:\s*(.+?)\s*(#.*)?$/
          .exec(line)
          ?.at(1);
        if (value === undefined) {
          return;
        }
        for (const element of value
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((part) => part.trim().replace(/^["']|["']$/g, ""))) {
          if (RETIRED_PATH.test(element)) {
            offences.push(`${path}:${index + 1} ${element}`);
          }
        }
      });
    }
    expect(offences).toEqual([]);
  });

  it("binds only style keys the published roster declares", () => {
    const outside = bindings
      .filter(
        (binding) =>
          STYLE_KEYS[binding.key.split("@").at(0) ?? ""] === undefined,
      )
      .map((binding) => `${binding.where} ${binding.key}`);
    expect(outside).toEqual([]);
  });

  it("consumes only symbols the strata declare", () => {
    // A name no stratum declares is not a value an anatomy writes — the `#` comment
    // on the line is where a reader meets it. An example that binds one teaches the
    // wrong habit, and the reader copies what they see.
    const symbols = loadSymbolIndex();
    const unexplained: string[] = [];
    for (const binding of bindings) {
      for (const element of binding.elements) {
        // A primitive — a keyword, a number, a dimension — carries no dot and is not
        // asked to resolve. `1.5` is a number, not a symbol.
        if (!/^[a-z]+(\.[A-Za-z0-9]+)+$/.test(element)) {
          continue;
        }
        if (symbols.names.has(element)) {
          continue;
        }
        unexplained.push(`${binding.where} ${binding.key}: ${element}`);
      }
    }
    expect(unexplained).toEqual([]);
  });

  it("teaches the value form, the roster and the comment", () => {
    const skill = readPackageFile(SKILL);
    // The things an author has to know, each stated in the skill itself.
    expect(skill).toContain("A style value is the symbol consumed");
    expect(skill).toContain("an ordered list of symbol names");
    expect(skill).toContain("The style keys are a closed roster");
    // The record for a name no stratum declares is the comment, not a register row.
    expect(skill).toContain("The comment is the record");
    expect(skill).toContain("no symbol declares it");
    expect(skill).not.toContain("anatomies/register.yaml");
    // The states the notation admits, the three newest included.
    expect(skill).toContain("Eight states, and only these");
    expect(skill).toContain("`indeterminate`");
    // And the retirements, so an author who knows the old notation is told.
    expect(skill).toContain("a trailing `?` marker");
  });
});

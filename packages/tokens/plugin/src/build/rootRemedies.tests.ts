/**
 * The `$root` remedies — the two defects the source carried, pinned shut.
 *
 * N1: a modifier redefined as a *token* a path the base authors as a *group*.
 * N2: five files authored a node bearing `$value` AND child members, which
 * format §6.1 makes a MUST-error.
 *
 * Both are properties of the SOURCE, so both are checked against the source
 * rather than against the build. Both assert ZERO rather than a count, because
 * a count would let one defect come back as another went away.
 *
 * N1 briefly carried a named list of four sites the remedy could not reach.
 * They are closed, so the list is gone and the assertion is empty again.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS = resolve(
  import.meta.dirname,
  "../../../tokens/tokens/canonical/global",
);

type Node = Record<string, unknown>;

const isObj = (v: unknown): v is Node =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isToken = (n: unknown): n is Node => isObj(n) && "$value" in n;
const members = (n: Node): string[] =>
  Object.keys(n).filter((k) => !k.startsWith("$"));

/** Every `*.tokens.json` under the canonical source, as `[path, parsed]`. */
function tokenFiles(dir = TOKENS, prefix = ""): [string, Node][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? tokenFiles(join(dir, e.name), `${prefix}${e.name}/`)
      : e.name.endsWith(".tokens.json")
        ? ([
            [
              `${prefix}${e.name}`,
              JSON.parse(readFileSync(join(dir, e.name), "utf8")) as Node,
            ],
          ] as [string, Node][])
        : [],
  );
}

/**
 * Walk a token tree, visiting every node with its dotted path.
 *
 * `$root` collapses to the parent path, as it does everywhere else — but the
 * walk also reports whether it ARRIVED through `$root`. That distinction is
 * the whole point of the remedy: a token at `color.text` is the N1 defect,
 * while a token at `color.text.$root` is the remedy, and both carry the same
 * collapsed path.
 */
function walk(
  node: unknown,
  path: string[],
  visit: (n: Node, p: string[], viaRoot: boolean) => void,
  viaRoot = false,
) {
  if (!isObj(node)) return;
  visit(node, path, viaRoot);
  for (const key of Object.keys(node)) {
    if (key.startsWith("$") && key !== "$root") continue;
    if (key === "$root") walk(node[key], path, visit, true);
    else walk(node[key], [...path, key], visit, false);
  }
}

describe("the $root remedies", () => {
  const files = tokenFiles();

  it("reads every canonical token file", () => {
    expect(files.length).toBe(45);
  });

  it("N2 — no node bears both $value and members (format §6.1)", () => {
    const offenders: string[] = [];
    for (const [name, doc] of files) {
      walk(doc, [], (n, p) => {
        if ("$value" in n && (members(n).length > 0 || "$root" in n)) {
          offenders.push(`${name}: ${p.join(".")}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("N1 — no modifier rebinds as a token what the base authors as a group", () => {
    // The base's own shape is the authority; nothing here is hand-listed.
    const group = new Set<string>();
    for (const [name, doc] of files) {
      if (!name.startsWith("semantic/color/")) continue;
      walk(doc, [], (n, p, viaRoot) => {
        if (viaRoot) return;
        if (
          !isToken(n) &&
          ("$root" in n || members(n).length > 0) &&
          p.length
        ) {
          group.add(p.join("."));
        }
      });
    }
    expect(group.size).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const [name, doc] of files) {
      if (!name.includes("modifier/")) continue;
      walk(doc, [], (n, p, viaRoot) => {
        if (!viaRoot && isToken(n) && group.has(p.join("."))) {
          offenders.push(`${name}: ${p.join(".")}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("no modifier states a reset — an alias naming the node it sits on", () => {
    // These moved to `surfaceResets` in the CSS profile. Written here they
    // would be circular: once the override is at `$root`, the alias is itself.
    const offenders: string[] = [];
    for (const [name, doc] of files) {
      if (!name.includes("modifier/")) continue;
      walk(doc, [], (n, p) => {
        if (n.$value === `{${p.join(".")}.$root}`) {
          offenders.push(`${name}: ${p.join(".")}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

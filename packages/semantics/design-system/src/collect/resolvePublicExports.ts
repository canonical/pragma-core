import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve which source files a package exports publicly, and under what names.
 *
 * The collector knows which FILE implements a block (the `@implements`
 * annotation sits in it) but not what a consumer types to get it. That name is
 * decided by the barrel chain between the package entry and the file, and it is
 * routinely NOT the file's own name: `Button/Button.tsx` is published as
 * `Button` through `export { default as Button }`, while
 * `Breadcrumbs/common/Item/Item.svelte` is published as `Breadcrumbs.Item` —
 * reachable only as a property of another component, never as a bare named
 * import.
 *
 * So the walk starts at the ENTRY and follows only real value re-export edges.
 * A file that the chain never reaches gets no name, and the caller emits no
 * import statement for it: an absent import is honest, a guessed one sends
 * someone to a symbol the package does not export. Type-only edges
 * (`export type *`, `export type { … }`, `type X` inside a clause) are not
 * followed for the same reason — they carry no value to import.
 */

/** Extensions a module specifier may resolve to, in preference order. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".svelte", ".js", ".jsx"] as const;

/** Where a public name came from: the file that actually declares it. */
export type PublicExportMap = ReadonlyMap<string, ReadonlySet<string>>;

/** `export * from "…"` — but not `export type * from "…"`. */
const STAR_REEXPORT = /(?<!\btype\s)\bexport\s+\*\s+from\s*["']([^"']+)["']/g;
/** `export { … } from "…"` — the clause is parsed separately. */
const NAMED_REEXPORT = /\bexport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
/** `export { … }` with no `from` — names declared in this very file. */
const LOCAL_EXPORT_CLAUSE = /\bexport\s*\{([^}]*)\}\s*(?!from)[;\n]/g;
/** `export const|function|class X` — a value declared and exported inline. */
const LOCAL_DECLARATION =
  /\bexport\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g;
/** `export type { … }` / `export type X` — no value, so never followed. */
const TYPE_EXPORT = /\bexport\s+type\b/;

/**
 * One `a as b` / `default as b` / `b` entry of an export clause.
 *
 * `local` is the name on the OTHER side of the edge (what the target module
 * calls it), `exported` the name this module publishes it under.
 */
interface ClauseEntry {
  readonly local: string;
  readonly exported: string;
}

/** Parse an export clause body, dropping its type-only entries. */
function parseClause(body: string): ClauseEntry[] {
  const entries: ClauseEntry[] = [];
  for (const raw of body.split(",")) {
    const part = raw.trim();
    if (part === "" || part.startsWith("type ")) {
      continue;
    }
    const aliased = part.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
    if (aliased) {
      entries.push({ local: aliased[1], exported: aliased[2] });
      continue;
    }
    if (/^[\w$]+$/.test(part)) {
      entries.push({ local: part, exported: part });
    }
  }
  return entries;
}

/**
 * Resolve a module specifier to a file on disk.
 *
 * Handles the `.js`-specifier-for-a-`.ts`-file convention these packages use
 * (`./Button.js` is written by `Button.tsx`), directory specifiers that mean
 * the folder's barrel, and extensionless specifiers.
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null; // A package import — outside this package's own chain.
  }
  const base = resolve(dirname(fromFile), specifier);
  const withoutJs = base.replace(/\.js$/, "");
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${withoutJs}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => join(withoutJs, `index${ext}`)),
    ...SOURCE_EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      return candidate;
    }
  }
  return null;
}

/**
 * The file a locally-declared name most likely stands for.
 *
 * A barrel that builds its export in place — svelte's `Breadcrumbs/index.ts`
 * imports the root component, hangs `Item` off it, then `export { Breadcrumbs }`
 * — declares the name locally, so no re-export edge points at the component
 * file. Attributing the name to a SIBLING whose basename matches it recovers
 * that case (`Breadcrumbs` → `Breadcrumbs.svelte`) without guessing: the match
 * is exact, same-directory, and falls back to the declaring file when no such
 * sibling exists.
 */
function principalSibling(declaringFile: string, name: string): string {
  const dir = dirname(declaringFile);
  for (const ext of SOURCE_EXTENSIONS) {
    const sibling = join(dir, `${name}${ext}`);
    if (existsSync(sibling)) {
      return sibling;
    }
  }
  return declaringFile;
}

/** The public names one module publishes, each mapped to its origin file. */
type ModuleExports = Map<string, string>;

/**
 * Walk one module's exports, following re-export edges into its dependencies.
 *
 * `seen` guards the cycles a barrel graph can contain; a module already on the
 * stack contributes nothing rather than recursing forever.
 */
async function exportsOf(
  file: string,
  cache: Map<string, ModuleExports>,
  seen: Set<string>,
): Promise<ModuleExports> {
  const cached = cache.get(file);
  if (cached) {
    return cached;
  }
  if (seen.has(file)) {
    return new Map();
  }
  seen.add(file);

  const result: ModuleExports = new Map();
  let source: string;
  try {
    source = await readFile(file, "utf-8");
  } catch {
    cache.set(file, result);
    return result;
  }

  for (const match of source.matchAll(STAR_REEXPORT)) {
    const target = resolveSpecifier(file, match[1]);
    if (!target) {
      continue;
    }
    for (const [name, origin] of await exportsOf(target, cache, seen)) {
      result.set(name, origin);
    }
  }

  for (const match of source.matchAll(NAMED_REEXPORT)) {
    if (TYPE_EXPORT.test(match[0])) {
      continue;
    }
    const target = resolveSpecifier(file, match[2]);
    if (!target) {
      continue;
    }
    const inner = await exportsOf(target, cache, seen);
    for (const { local, exported } of parseClause(match[1])) {
      // A `default as X` edge has no named counterpart in the target, and the
      // target file IS the origin — which is exactly the common component case.
      result.set(exported, inner.get(local) ?? target);
    }
  }

  for (const match of source.matchAll(LOCAL_EXPORT_CLAUSE)) {
    for (const { exported } of parseClause(match[1])) {
      result.set(exported, principalSibling(file, exported));
    }
  }

  for (const match of source.matchAll(LOCAL_DECLARATION)) {
    if (TYPE_EXPORT.test(match[0])) {
      continue;
    }
    result.set(match[1], principalSibling(file, match[1]));
  }

  seen.delete(file);
  cache.set(file, result);
  return result;
}

/**
 * Map every publicly-exported source file of a package to the names it is
 * exported under, starting from `entryFile`.
 *
 * A missing entry file yields an empty map rather than throwing: a package
 * without a resolvable barrel simply contributes no import statements, which is
 * the same outcome as one whose files are all internal.
 */
export default async function resolvePublicExports(
  entryFile: string,
): Promise<PublicExportMap> {
  const byFile = new Map<string, Set<string>>();
  if (!existsSync(entryFile)) {
    return byFile;
  }
  const rootExports = await exportsOf(entryFile, new Map(), new Set());
  for (const [name, origin] of rootExports) {
    const names = byFile.get(origin) ?? new Set<string>();
    names.add(name);
    byFile.set(origin, names);
  }
  return byFile;
}

/**
 * The name to import a file by, when it has one.
 *
 * A file exported under several names (an alias kept for compatibility, say)
 * resolves to the one matching its own basename, and otherwise to the first in
 * sort order — a deterministic pick, so regenerated Turtle diffs cleanly.
 */
export function importNameFor(
  exports: PublicExportMap,
  file: string,
): string | undefined {
  const names = exports.get(file);
  if (!names || names.size === 0) {
    return undefined;
  }
  const basename = file
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "");
  const sorted = [...names].sort();
  return sorted.find((name) => name === basename) ?? sorted[0];
}

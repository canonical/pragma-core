import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Task } from "@canonical/task";
import { info, map } from "@canonical/task";

/**
 * Resolve the version ranges that a generated app pins for the @canonical/*
 * packages it depends on directly. Those packages come from two repositories,
 * each released on its own version line:
 *
 * - **pragma-web** — everything that renders and runs in the app:
 *   react-ds-global(-form), react-ds-app, react-head, react-hooks, react-ssr,
 *   router-core, router-react, i18n-*, ds-*, styles, storybook-*,
 *   typescript-config-react. Pinned to `PRAGMA_WEB_VERSION`.
 * - **pragma-core** — the toolchain this generator ships with, of which the app
 *   depends only on biome-config. Pinned to this generator's own version, since
 *   summon-application is released in lockstep with the rest of pragma-core.
 *
 * Scope notes:
 * - Third-party deps (react, express, vite…) keep their own ranges.
 * - `@canonical/design-tokens` is versioned SEPARATELY and is NOT pinned here —
 *   it reaches the app transitively via `@canonical/styles`, which owns its range.
 *
 * Resolution is fully offline, by design: `pragma create` performs no network
 * calls, and two scaffolds of the same generator are byte-identical (a registry
 * lookup here once made concurrent scaffolds race the network and diverge).
 */

/**
 * The pragma-web release the templates are written against. The templates
 * import from these packages (the application shell's `SelectInput`, say), so
 * this is the oldest release they build with, and the caret range keeps a
 * generated app on that minor line. Renovate tracks it through
 * `@canonical/react-ds-global`, one of the packages released at this version;
 * a bump is reviewed against the templates rather than merged on sight.
 */
export const PRAGMA_WEB_VERSION = "0.45.0";

const OWN_PACKAGE = "@canonical/summon-application";

/**
 * Walk up from `from` until a `package.json` names `packageName`, and return
 * its version. A manifest that is unreadable, is not JSON, names another
 * package, or carries no version is just an ancestor directory that happens to
 * hold a `package.json`, so the walk continues; running out of parents yields
 * "unknown".
 *
 * @note Impure — reads the filesystem.
 */
function findVersionAbove(from: string, packageName: string): string {
  let dir = from;
  for (;;) {
    try {
      const manifest = JSON.parse(
        readFileSync(path.join(dir, "package.json"), "utf-8"),
      ) as { name?: string; version?: string };
      if (manifest.name === packageName && manifest.version) {
        return manifest.version;
      }
    } catch {
      // No readable manifest at this level — keep walking.
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return "unknown";
    }
    dir = parent;
  }
}

/**
 * Read an installed package's version. Not `require("<pkg>/package.json")`:
 * none of the workspace packages export `./package.json` (and their ESM-only
 * exports maps make `require.resolve` itself throw), so module resolution is
 * avoided entirely — the standard `node_modules/<name>/package.json` location
 * is probed at each ancestor of this module instead, exactly the way node
 * itself would look the package up.
 *
 * @note Impure — reads the filesystem.
 */
export function readVersion(packageName: string): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const manifest = JSON.parse(
        readFileSync(
          path.join(
            dir,
            "node_modules",
            ...packageName.split("/"),
            "package.json",
          ),
          "utf-8",
        ),
      ) as { version?: string };
      if (manifest.version) {
        return manifest.version;
      }
    } catch {
      // No such package at this level — keep walking.
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return "unknown";
    }
    dir = parent;
  }
}

/**
 * This generator's own version, read by walking up from THIS module — correct
 * from `src/` and from `dist/esm/` alike, with no build-layout coupling (see
 * summon-package's packageVersion for the full rationale). Lazy and cached so
 * importing this module performs no IO.
 */
let cachedOwnVersion: string | undefined;
export function ownVersion(): string {
  cachedOwnVersion ??= findVersionAbove(
    path.dirname(fileURLToPath(import.meta.url)),
    OWN_PACKAGE,
  );
  return cachedOwnVersion;
}

/**
 * The generator's own release-line version, used as the range for the
 * pragma-core packages. The module always sits inside its own package, so the
 * walk cannot miss in practice; the "latest" escape survives only as a last
 * resort for a mangled installation.
 */
function coreRange(): string {
  const own = ownVersion();
  return own === "unknown" ? "latest" : `^${own}`;
}

/** The version range pinned for each repository's packages. */
export interface PinnedRanges {
  /** Range for the pragma-core packages (the generator's release line). */
  readonly core: string;
  /** Range for the pragma-web packages (`PRAGMA_WEB_VERSION`). */
  readonly web: string;
}

/**
 * Resolve the version ranges as a Task so the decision is visible in the
 * generator pipeline (dry-run included). Deterministic and offline.
 */
export function resolvePragmaVersion(): Task<PinnedRanges> {
  const ranges: PinnedRanges = {
    core: coreRange(),
    web: `^${PRAGMA_WEB_VERSION}`,
  };
  return map(
    info(
      `Pinning @canonical/* packages: pragma-web to ${ranges.web}, ` +
        `pragma-core to ${ranges.core} (the installed generator's release line).`,
    ),
    () => ranges,
  );
}

/**
 * Print a version table for the current generator run.
 */
export function printVersions(generatorName: string): Task<void> {
  return info(
    `@canonical/summon-core         ${readVersion("@canonical/summon-core")}\n` +
      `@canonical/summon-application  ${ownVersion()}  (${generatorName})`,
  );
}

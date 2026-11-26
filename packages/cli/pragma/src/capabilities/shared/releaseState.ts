/**
 * Unreleased-change detector for `doctor`'s `pragma version` check.
 *
 * The version a CLI reports is the version in its `package.json`, so a build
 * from a checkout several pull requests past `v0.46.0` still says `0.46.0`, and
 * so does a published CLI whose store was built from a pack on `main`. This
 * module names the parts that are past their release, so `doctor` can say so
 * instead of implying a release that the running code or data is not.
 *
 * Two parts are checked:
 *
 * - **The CLI itself.** An install under `node_modules` is a published release.
 *   Anywhere else the package is a source checkout, and git says how many
 *   commits touch the package since the last `v*` tag, and whether it has
 *   uncommitted changes.
 * - **Its contents.** Only when the store answering reads was built from the
 *   configured packs (the embedded snapshot is whatever the CLI shipped). A
 *   `file://` pack is checked the same way as the CLI; a `git+…#ref` pack is
 *   unreleased unless its ref is a version tag; an npm pack is a release.
 *
 * Read-only: a handful of `git` reads with a short timeout, each of which
 * silently yields nothing when git is missing or the folder is not a checkout.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfigLayers } from "../../kernel/config/types.js";
import { readManifest } from "../../kernel/runtime/graphpack/manifest.js";
import {
  type PackageRef,
  parsePackDeclaration,
} from "../../kernel/runtime/refs/parseRef.js";
import { resolveSources } from "../../kernel/runtime/resolveSources.js";
import { PRAGMA_PACKAGE } from "./registry.js";

/** One part of the running CLI that is past its release. */
export interface UnreleasedPart {
  /** `CLI` for the command itself, or the pack's package name. */
  readonly name: string;
  /** What is unreleased about it, in one line. */
  readonly detail: string;
}

/** Runs `git` in a folder and returns its trimmed output, or `undefined`. */
export type GitReader = (
  dir: string,
  args: readonly string[],
) => string | undefined;

/** Everything the classifier reads, captured as a value for tests. */
export interface ReleaseProbe {
  /** The CLI package root (realpath-resolved), when it could be found. */
  readonly cliRoot?: string;
  /** The configured packs, present only when the store was built from them. */
  readonly packs: readonly PackageRef[];
  /** Package name → the commit a git pack resolved to when the store was built. */
  readonly packCommits: Readonly<Record<string, string>>;
  /** The folder `file://` paths resolve against. */
  readonly cwd: string;
  readonly git: GitReader;
}

/** A version tag, as a git pack's ref: `v0.46.0`, `0.46.0`, `v1.0.0-rc.1`. */
const VERSION_TAG = /^v?\d+\.\d+\.\d+([-+].*)?$/;

/**
 * Describe where a checked-out folder stands against its last release tag.
 *
 * @returns The ways it is past the release (empty when it matches the tag
 *   exactly), or `undefined` when the folder is not in a git checkout.
 */
function checkoutChanges(dir: string, git: GitReader): string[] | undefined {
  if (git(dir, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    return undefined;
  }
  const changes: string[] = [];
  const tag = git(dir, [
    "describe",
    "--tags",
    "--abbrev=0",
    "--match",
    "v[0-9]*",
  ]);
  if (tag === undefined) {
    changes.push("no release tag");
  } else {
    const count = Number(
      git(dir, ["rev-list", "--count", `${tag}..HEAD`, "--", "."]) ?? 0,
    );
    if (count > 0) {
      changes.push(`${count} commit${count === 1 ? "" : "s"} after ${tag}`);
    }
  }
  if ((git(dir, ["status", "--porcelain", "--", "."]) ?? "") !== "") {
    changes.push("uncommitted changes");
  }
  return changes;
}

/** Whether a path sits inside a `node_modules` tree (a published install). */
function isInstalledPackage(path: string): boolean {
  return path.split(/[\\/]/).includes("node_modules");
}

/**
 * Name every part of the running CLI that is past its release.
 *
 * @param probe - The CLI root, the packs the store was built from, and git.
 * @returns The unreleased parts, the CLI first; empty when all are releases.
 */
export function describeUnreleased(
  probe: ReleaseProbe,
): readonly UnreleasedPart[] {
  const parts: UnreleasedPart[] = [];

  if (probe.cliRoot !== undefined && !isInstalledPackage(probe.cliRoot)) {
    const changes = checkoutChanges(probe.cliRoot, probe.git);
    if (changes !== undefined && changes.length > 0) {
      parts.push({
        name: "CLI",
        detail: `${changes.join(", ")} (local build at ${probe.cliRoot})`,
      });
    }
  }

  for (const pack of probe.packs) {
    if (pack.kind === "file") {
      const dir = resolve(probe.cwd, pack.path);
      const changes = checkoutChanges(dir, probe.git);
      if (changes === undefined) {
        parts.push({
          name: pack.pkg,
          detail: `local folder, not a git checkout (${dir})`,
        });
      } else if (changes.length > 0) {
        parts.push({
          name: pack.pkg,
          detail: `${changes.join(", ")} (local checkout at ${dir})`,
        });
      }
    } else if (pack.kind === "git" && !VERSION_TAG.test(pack.ref)) {
      const commit = probe.packCommits[pack.pkg];
      parts.push({
        name: pack.pkg,
        detail: `tracks ${pack.ref}${commit ? ` at ${commit.slice(0, 7)}` : ""}, not a release`,
      });
    }
  }

  return parts;
}

/** Package name → resolved commit, read from a manifest's `sourceRef`
 * (`name@git:<sha>` entries, comma-separated). */
function commitsFromSourceRef(sourceRef: string): Record<string, string> {
  const commits: Record<string, string> = {};
  for (const entry of sourceRef.split(",")) {
    const at = entry.trim().lastIndexOf("@git:");
    if (at > 0) {
      commits[entry.trim().slice(0, at)] = entry.trim().slice(at + 5);
    }
  }
  return commits;
}

/**
 * The CLI package root: the OUTERMOST folder above this module whose
 * `package.json` is the CLI's. The build emits a copy of `package.json` into
 * `dist/`, so the nearest match is the build output, which git ignores and
 * would always report as clean.
 */
function findCliRoot(): string | undefined {
  let root: string | undefined;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, "utf-8")).name === PRAGMA_PACKAGE)
          root = dir;
      } catch {
        // An unreadable package.json is not ours; keep walking.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return root;
    dir = parent;
  }
}

/** `git -C <dir> …` with a short timeout; `undefined` on any failure. */
const readGit: GitReader = (dir, args) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
  } catch {
    return undefined;
  }
};

/**
 * Name every part of the running CLI that is past its release, for the
 * current project.
 *
 * @param layers - The resolved config layers (for the configured packs).
 * @param cwd - The project folder the command runs in.
 * @returns The unreleased parts; empty when the CLI and its store are releases.
 * @note Impure — reads the filesystem and runs `git`.
 */
export function detectUnreleased(
  layers: ConfigLayers,
  cwd: string,
): readonly UnreleasedPart[] {
  const decision = resolveSources(layers, cwd);
  const builtFromPacks = decision.kind === "pack";
  const packs = builtFromPacks
    ? (layers.config.packs ?? []).flatMap((entry) => {
        try {
          return [parsePackDeclaration(entry)];
        } catch {
          return [];
        }
      })
    : [];
  const manifest = builtFromPacks ? readManifest(decision.dir) : undefined;
  return describeUnreleased({
    cliRoot: findCliRoot(),
    packs,
    packCommits: manifest ? commitsFromSourceRef(manifest.sourceRef) : {},
    cwd,
    git: readGit,
  });
}

/**
 * `describeUnreleased` — which parts of the running CLI are past their release.
 *
 * The regression this pins: a CLI built from a checkout several pull requests
 * past its tag, or answering from a store built off `main`, reported the bare
 * `package.json` version, as if it were that release. Each case below drives
 * the classifier with a fake `git`, so no real checkout is needed.
 */

import { describe, expect, it } from "vitest";
import type { PackageRef } from "../../kernel/runtime/refs/parseRef.js";
import { describeUnreleased, type GitReader } from "./releaseState.js";

/** A fake `git` over a map of folder → answers, keyed by the first argument. */
function fakeGit(
  repos: Record<
    string,
    { tag?: string; commits?: number; dirty?: boolean } | undefined
  >,
  remote?: { tagged: readonly string[]; calls?: string[] },
): GitReader {
  return (dir, args) => {
    if (args[0] === "ls-remote") {
      remote?.calls?.push(args[2] ?? "");
      return remote?.tagged
        .map((sha, i) => `${sha}\trefs/tags/v0.${i}.0^{}`)
        .join("\n");
    }
    const repo = repos[dir];
    if (repo === undefined) return undefined;
    switch (args[0]) {
      case "rev-parse":
        return "true";
      case "describe":
        return repo.tag;
      case "rev-list":
        return String(repo.commits ?? 0);
      case "status":
        return repo.dirty ? " M src/index.ts" : "";
      default:
        return undefined;
    }
  };
}

const file = (pkg: string, path: string): PackageRef => ({
  kind: "file",
  pkg,
  path,
  source: `file://${path}`,
});

const git = (pkg: string, ref: string): PackageRef => ({
  kind: "git",
  pkg,
  url: "https://github.com/canonical/pragma-core.git",
  ref,
  source: `git+https://github.com/canonical/pragma-core.git#${ref}`,
});

describe("describeUnreleased — the CLI itself", () => {
  it("a published install under node_modules is a release", () => {
    const parts = describeUnreleased({
      cliRoot: "/home/u/.bun/install/global/node_modules/@canonical/pragma-cli",
      packs: [],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({}),
    });
    expect(parts).toEqual([]);
  });

  it("a checkout exactly at its tag is a release", () => {
    const parts = describeUnreleased({
      cliRoot: "/src/pragma",
      packs: [],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({ "/src/pragma": { tag: "v0.46.0", commits: 0 } }),
    });
    expect(parts).toEqual([]);
  });

  it("a checkout past its tag names the commits and uncommitted changes", () => {
    const parts = describeUnreleased({
      cliRoot: "/src/pragma",
      packs: [],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({
        "/src/pragma": { tag: "v0.46.0", commits: 3, dirty: true },
      }),
    });
    expect(parts).toEqual([
      {
        name: "CLI",
        detail:
          "3 commits after v0.46.0, uncommitted changes (local build at /src/pragma)",
      },
    ]);
  });

  it("one commit is singular", () => {
    const [part] = describeUnreleased({
      cliRoot: "/src/pragma",
      packs: [],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({ "/src/pragma": { tag: "v0.46.0", commits: 1 } }),
    });
    expect(part?.detail).toMatch(/^1 commit after v0\.46\.0 /);
  });

  it("an unfindable root or a folder outside git reports nothing", () => {
    expect(
      describeUnreleased({
        packs: [],
        packCommits: {},
        cwd: "/work",
        git: fakeGit({}),
      }),
    ).toEqual([]);
    expect(
      describeUnreleased({
        cliRoot: "/opt/pragma",
        packs: [],
        packCommits: {},
        cwd: "/work",
        git: fakeGit({}),
      }),
    ).toEqual([]);
  });
});

describe("describeUnreleased — the packs the store was built from", () => {
  it("a local checkout past its tag is unreleased, resolved against cwd", () => {
    const parts = describeUnreleased({
      packs: [file("@canonical/design-system", "../core/design-system")],
      packCommits: {},
      cwd: "/work/app",
      git: fakeGit({
        "/work/core/design-system": { tag: "v0.46.0", commits: 2 },
      }),
    });
    expect(parts).toEqual([
      {
        name: "@canonical/design-system",
        detail:
          "2 commits after v0.46.0 (local checkout at /work/core/design-system)",
      },
    ]);
  });

  it("a local checkout at its tag is a release", () => {
    const parts = describeUnreleased({
      packs: [file("@canonical/design-system", "/core/design-system")],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({ "/core/design-system": { tag: "v0.46.0" } }),
    });
    expect(parts).toEqual([]);
  });

  it("a local folder outside git is unreleased", () => {
    const parts = describeUnreleased({
      packs: [file("@canonical/design-system", "/tmp/ds")],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({}),
    });
    expect(parts).toEqual([
      {
        name: "@canonical/design-system",
        detail: "local folder, not a git checkout (/tmp/ds)",
      },
    ]);
  });

  const SHA = "6c25b1b50f2cede30d9260edd91ac614f1380457";
  const RELEASE = "f9c8577bbd5e4657e793b7092c3931102714b8ca";

  it("a git pack on a branch past the release tags is unreleased", () => {
    const parts = describeUnreleased({
      packs: [git("@canonical/ds-implementations", "main")],
      packCommits: { "@canonical/ds-implementations": SHA },
      cwd: "/work",
      git: fakeGit({}, { tagged: [RELEASE] }),
    });
    expect(parts).toEqual([
      {
        name: "@canonical/ds-implementations",
        detail: "tracks main at 6c25b1b, not a release",
      },
    ]);
  });

  it("a git pack on a branch whose commit is a release tag is a release", () => {
    // The state right after every release: `main` is the tagged commit.
    const calls: string[] = [];
    const parts = describeUnreleased({
      packs: [
        git("@canonical/design-system", "main"),
        git("@canonical/anatomy-dsl", "main"),
      ],
      packCommits: {
        "@canonical/design-system": RELEASE,
        "@canonical/anatomy-dsl": RELEASE,
      },
      cwd: "/work",
      git: fakeGit({}, { tagged: [SHA, RELEASE], calls }),
    });
    expect(parts).toEqual([]);
    // Two packs from one remote ask it once.
    expect(calls).toEqual(["https://github.com/canonical/pragma-core.git"]);
  });

  it("a branch pack is left out when the remote or its commit is unknown", () => {
    expect(
      describeUnreleased({
        packs: [git("@canonical/design-system", "main")],
        packCommits: { "@canonical/design-system": SHA },
        cwd: "/work",
        git: fakeGit({}),
      }),
    ).toEqual([]);
    expect(
      describeUnreleased({
        packs: [git("@canonical/design-system", "main")],
        packCommits: {},
        cwd: "/work",
        git: fakeGit({}, { tagged: [RELEASE] }),
      }),
    ).toEqual([]);
  });

  it("a git pack on a version tag, and an npm pack, are releases", () => {
    const parts = describeUnreleased({
      packs: [
        git("@canonical/design-system", "v0.46.0"),
        {
          kind: "npm",
          pkg: "@canonical/code-standards",
          source: "@canonical/code-standards",
        },
      ],
      packCommits: {},
      cwd: "/work",
      git: fakeGit({}),
    });
    expect(parts).toEqual([]);
  });
});

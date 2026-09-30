---
name: start-change
description: Starts a change in canonical/pragma-core or canonical/pragma-web. Picks the repository the change belongs in, creates a branch and its worktree from origin/main, installs with the pinned Bun, and names the skill for each next step. Use at the start of any change to either pragma repository, before creating a branch.
---

# Start a change

Use this at the start of any change to `canonical/pragma-core` or `canonical/pragma-web`. It gets the change into the right repository and onto a clean branch, then hands over to the skill for each next step.

## Checklist

```
- [ ] 1. Pick the repository
- [ ] 2. Create the branch and its worktree
- [ ] 3. Install with the pinned Bun
- [ ] 4. Read what applies to this repository
- [ ] 5. Load the code standards for the code you will write
```

## 1. Pick the repository

- **pragma-core holds the toolchain.** That means the `pragma` and `summon` command-line tools and the generators, `webarchitect`, the Biome, TypeScript and Renovate configurations, `utils`, `task`, `ke`, `ke-graphql`, `harnesses`, the design tokens and the design-system models.
- **pragma-web holds everything that renders.** That means the React, Svelte and Lit components, the stylesheets, Storybook, the runtime packages, the applications and the documentation site. Anything that renders belongs to pragma-web, even when a generator in pragma-core emits it.
- **pragma-web consumes pragma-core from npm**, pinned to exact versions. A change to a pragma-core package is a pull request in pragma-core. Once it is released, pragma-web bumps the pin (the `change-dependencies` skill).
- **A change that spans both repositories is two pull requests**, one in each. The pragma-core one normally lands first, and each body names the other in full (the `open-pull-request` skill).
- **Some files are shared.** `AGENTS.md`, `.kb/agents.md` and `CONSTITUTION.md` have their originals in pragma-core. pragma-web's copies start with `<!-- Copied from <url of the original>; change it there first. -->`. Change the original first, then the copy, in paired pull requests.

## 2. Create the branch and its worktree

The branch name follows the code standard `cs:git.branch.name`, with the commit types this repository allows (the `commit-changes` skill). Look the standard up with the pragma MCP tool `standard_lookup`.

Branch from an up-to-date `origin/main`, in a worktree under `.claude/worktrees/`. Name the worktree folder after the branch, with the `/` replaced by `-`:

```bash
git fetch origin
# branch feat/minor-cli-improvements  →  worktree folder feat-minor-cli-improvements
git worktree add -b feat/minor-cli-improvements \
  .claude/worktrees/feat-minor-cli-improvements origin/main
```

Each line of work stays isolated, several can run in parallel, and the main checkout stays untouched. Nobody pushes to `main`: every change lands through a pull request.

## 3. Install with the pinned Bun

- **Bun is pinned in `.bun-version`.** Compare it with `bun --version`. When they differ, run the pinned Bun through `bunx`, for example `bunx bun@$(cat .bun-version) install`.
- **Node must be in the root `engines` range** (`^22.13.0 || ^24.0.0 || ^26.0.0`), because Lerna requires it. `bun install` warns when the local Node is outside it.
- **A fresh worktree has no `node_modules`.** Run `bun install` in it before the first `check` or `test`.

## 4. Read what applies to this repository

Read `.kb/this-repository.md`. It says what is specific to this repository and names the topic file for each area, for example generators, graph packs or Chromatic. Read the topic files for the area you are about to change.

## 5. Load the code standards

Before writing code, find the standards that apply with the pragma MCP tool `standard_list` (filter by category, such as `react`, `css`, `packaging` or `testing`). Read them with `standard_lookup` and `detail: "detailed"`, which returns the dos and the don'ts. Follow them, and look for the existing convention in a sibling package when no standard covers a choice.

## Next

| When you… | Load |
| --- | --- |
| change a dependency, a version, a `package.json` or `bun.lock` | `change-dependencies` |
| commit | `commit-changes` |
| get the branch push-ready and push it | `push-branch` |
| open or update a pull request | `open-pull-request` |
| file, triage or move an issue | `file-issue` |
| change a workflow or add a check | `change-ci` |

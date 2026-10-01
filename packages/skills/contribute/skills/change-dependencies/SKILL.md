---
name: change-dependencies
description: Changes a dependency, a version range or the lockfile in canonical/pragma-core or canonical/pragma-web. Covers regenerating bun.lock with the pinned Bun, sibling ranges, peer dependencies, TypeScript configurations and the sigstore patch. Use when adding, removing or bumping a dependency, changing a version, or resolving a bun.lock conflict in either pragma repository.
---

# Change dependencies

Use this when a change adds, removes or bumps a dependency, changes a version, or touches `bun.lock` in `canonical/pragma-core` or `canonical/pragma-web`.

## Checklist

```
- [ ] 1. Use the pinned Bun for every install
- [ ] 2. Edit the manifests
- [ ] 3. Regenerate the lockfile: two installs, then a third that changes nothing
- [ ] 4. Read the lockfile diff and disclose what else moved
- [ ] 5. Apply this repository's notes in .kb/this-repository.md
```

## 1. Use the pinned Bun

`bun.lock` is regenerated only with the Bun pinned in `.bun-version`. Another version writes the lockfile differently from the one CI compares against, and the difference is not visible by eye. A version mismatch is a blocker, not a caveat. When `bun --version` differs from the pin, run `bunx bun@$(cat .bun-version) install`.

npm appears only for the first publish of a new package (`.kb/publishing.md`). Never run `npm install`.

## 2. Edit the manifests

- **Sibling ranges stay explicit.** Never use the `workspace:` protocol: every package must stay installable on its own. The root `check:ranges` script checks the ranges between siblings.
- **Remove an unused peer dependency.** Do not mark it optional instead: `optionalDependencies` would install the package into every consumer.
- **Shared TypeScript configurations keep old majors in their peer range**, for example `^5.9.3 || ^6.0.0 || ^7.0.0`. Drop a major only when a change requires it.
- **TypeScript 7 no longer loads every installed `@types/*` package** (`types` defaults to `[]`). A package names the ones it needs, for example `"types": ["bun"]`.
- **When `@biomejs/biome` is bumped, update every `biome.json` whose `$schema` names a Biome version.** A schema left behind makes `biome check` fail to read its configuration.
- **In pragma-core, every package manifest keeps its `repository` field.** npm's provenance check requires it to name the repository that runs the release, and Renovate groups a pragma-core release into one pull request by it.

## 3. Regenerate the lockfile

- **Run `bun install` twice.** When a change edits workspace versions and sibling ranges together, Bun records the new versions on the first install and the new ranges only on the second. The second install works around a Bun bug; drop it once the pinned Bun includes the upstream fix ([oven-sh/bun#41931](https://github.com/oven-sh/bun/pull/41931)).
- **A third `bun install` must leave `bun.lock` unchanged.** Commit the result.
- **Never hand-merge `bun.lock`.** Resolve a conflict by regenerating it with the pinned Bun and committing the regenerated file.

## 4. Read the lockfile diff

- **Regenerating the lockfile can dedupe other packages within their declared ranges.** Say so in the pull request body.
- **Keep `sigstore` at the exact version the root `patchedDependencies` patch names.** The patch prevents half-published releases and applies only to that version, and Bun installs an unpatched version without any warning. A step in `pr.yml` fails when the lockfile no longer carries the patch.

## 5. Apply this repository's notes

`.kb/this-repository.md` names any topic here that applies to dependencies.

Then commit (the `commit-changes` skill) and push (the `push-branch` skill).

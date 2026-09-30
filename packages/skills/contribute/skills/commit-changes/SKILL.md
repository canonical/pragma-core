---
name: commit-changes
description: Writes commits in canonical/pragma-core or canonical/pragma-web. Covers the conventional-commit subject with the types this repository allows, the package as scope, breaking changes before 1.0, atomic commits and the changelog reader. Use when committing, or when rewording commits before the first push, in either pragma repository.
---

# Commit changes

Use this when committing in `canonical/pragma-core` or `canonical/pragma-web`.

## The subject

- **Follow the code standards for the commit message and its scope** (`cs:git.commit.message`, `cs:git.commit.scope`).
- **Use only the types `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `ci` and `revert`.** `pr-lint.yml` rejects any other type in a pull request title.
- **The scope is the package**: its folder or its npm name, without `@canonical/`, for example `feat(pragma-cli): …` or `fix(code-standards): …`. The pull request title becomes the squash commit, which becomes the changelog line.
- **`!` marks only a change that breaks consumers** (`feat(router)!: …`). A development-dependency bump changes nothing for consumers and is not breaking.
- **Before 1.0, a breaking change cannot go out in a pre-release.** Lerna would move the major version, and the release's version script refuses that. Only a stable release turns a breaking change into a minor bump at 0.x.

## The commits

- **Keep commits atomic**: one logical change per commit.
- **Write for the changelog reader.** Lerna generates `CHANGELOG.md` from the history, so a subject is read by people who never saw the branch. It cites no internal planning document, just as a pull request body does not (the `open-pull-request` skill).
- **Tidy the history before the first push.** Reword `WIP` and `fix typo` commits into conventional subjects and squash noise. After the first push, the `push-branch` skill says what may still change.

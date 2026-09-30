---
name: commit-changes
description: Writes commits in canonical/pragma-core or canonical/pragma-web. Covers the conventional-commit subject with the types this repository allows, the package as scope, breaking changes, atomic commits and the changelog reader. Use when committing, or when rewording commits before the first push, in either pragma repository.
---

# Commit changes

Use this when committing in `canonical/pragma-core` or `canonical/pragma-web`.

## The subject

- **Follow the code standards `cs:git.commit.message` and `cs:git.commit.scope`.** Look them up with the pragma MCP tool `standard_lookup`.
- **The allowed types are `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `ci` and `revert`.** `pr-lint.yml` accepts only these in a pull request title, so use no others.
- **The scope is the package**: its folder or its npm name, without `@canonical/`, for example `feat(pragma-cli): …` or `fix(code-standards): …`. The pull request title becomes the squash commit, which becomes the changelog line.
- **`!` marks only a change that breaks consumers** (`feat(router)!: …`). A development-dependency bump changes nothing for consumers and is not breaking.
- **Before 1.0, a breaking change ships in a minor version**, and the release's version script refuses a pre-release that changes the major. Otherwise `feat` bumps the minor version and the other types the patch, so a change that must reach consumers as a minor needs `feat`.

## The commits

- **Keep commits atomic.** One logical change per commit, so each diff is reviewable on its own. An unrelated item bundled into the same pull request is rare and is called out in its body as a drive-by.
- **Write for the changelog reader.** Lerna generates `CHANGELOG.md` from the history, so a subject is read by people who never saw the branch. It cites no internal planning document, just as a pull request body does not (`open-pull-request`).
- **Tidy the history before the first push.** Reword `WIP` and `fix typo` commits into conventional subjects and squash noise. After the first push, the `push-branch` skill says what may still change.

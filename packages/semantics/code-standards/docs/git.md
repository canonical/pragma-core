# Git Standards

Standards for git development.

## Semantic branch prefixes

**Identifier:** `cs:git.branch.name`

Branch names must follow a semantic prefix/description pattern using `/` as separator. The prefix communicates the intent of the branch (feature, fix, chore, etc.) and the description uses kebab-case to summarize the work. This convention enables CI filtering, changelog grouping, and at-a-glance understanding of what a branch carries.

### Do

Use a semantic prefix followed by `/` and a kebab-case description.
```
feat/add-search-component
fix/header-overflow
chore/update-dependencies
docs/api-reference
refactor/extract-auth-middleware
test/add-integration-coverage
ci/add-deploy-workflow
perf/optimize-query-performance
```

Use the same prefix vocabulary as conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`).
```bash
git checkout -b feat/dark-mode-toggle
git checkout -b fix/login-redirect-loop
git checkout -b chore/bump-node-version
```

Keep descriptions concise but specific enough to identify the work.
```
feat/user-avatar          # Good: clear what it adds
fix/csv-export-encoding   # Good: identifies the bug area
```

### Don't

Use flat branch names without a semantic prefix.
```
dark-mode
fix-bug
updates
```

Use separators other than `/` between prefix and description.
```
feat-dark-mode         # Wrong: dash instead of slash
feat_dark_mode         # Wrong: underscore
feat.dark-mode         # Wrong: dot
```

Use vague or overly broad descriptions.
```
feat/stuff
fix/issue
chore/misc
```

Use uppercase or camelCase in the description portion.
```
feat/AddSearchComponent   # Wrong: PascalCase
feat/addSearch            # Wrong: camelCase
feat/Add-Search           # Wrong: capitalized
```

---

## Conventional commit messages

**Identifier:** `cs:git.commit.message`

Commits on the main branch follow Conventional Commits: `type(scope): subject`. The subject is a third-person verb phrase. It states what the change does. The reviewer checks the diff against it. A change that needs more than one phrase is split.

### Do

Structure commit messages as `type(scope): subject`.
```
feat(auth): adds the OAuth2 login flow
fix(csv-export): strips the UTF-8 BOM from the output
chore(deps): bumps vitest to 3.2
docs(api): documents the rate-limiting headers
refactor(router): extracts the middleware chain into its own module
test(auth): covers token refresh with integration tests
ci(ci): adds a staging deployment workflow
perf(queries): adds an index for user lookup
```

Say what the change does. Give `fixes` and `refactors` their object.
```
feat(button): adds a loading state
fix(form): prevents double submission on Enter
refactor(router): refactors route matching into a lookup table
```

Add a body separated by a blank line for non-trivial changes, and a footer for breaking changes.
```
feat(api)!: renames the pagination response fields

The `results` field is now `items` and `total` is replaced by `hasMore`.
Clients must update their response handlers.

BREAKING CHANGE: pagination response fields renamed
```

Keep the subject line under 72 characters.
```
feat(search): adds fuzzy matching with a configurable threshold
```

### Don't

Write commit messages without a type prefix.
```
added search feature
fix bug in login
update dependencies
```

Name an activity without a claim, list several things, or write a fragment.
```
feat(ui): improves the button                        # Wrong: says nothing about the change
fix(form): fixes a bug                               # Wrong: names no defect
feat(table): adds sorting, paging and a filter bar   # Wrong: a list; split the PR
docs(api): rate-limiting headers                     # Wrong: noun fragment
feat(auth): add OAuth2 login                         # Wrong: imperative, use "adds"
```

Write vague descriptions that don't explain the change.
```
fix(app): fix bug
feat(ui): update component
chore: stuff
refactor: clean up
```

Exceed 72 characters in the subject line.
```
feat(search): adds fuzzy matching with a configurable threshold and falls back to exact match when the score is below the minimum
```

---

## Scope commits by package

**Identifier:** `cs:git.commit.scope`

The scope is required: the workspace package name without `@canonical/`, or `deps`, `monorepo`, `constitution` or `ci` for a change that belongs to no package. Comma-separate scopes only when a change cannot be split.

### Do

Use the package name (without namespace) as scope in a monorepo.
```
feat(button): adds an outline variant
fix(form-utils): accepts empty field arrays
chore(cli): renames the bin entry point to pragma
```

Use the module or feature area as scope in a single-package repo.
```
feat(auth): adds session refresh
fix(api): retries requests that return 429
refactor(router): splits route definitions into one file per domain
```

Use `monorepo` for root files that belong to no package and `ci` for workflows and actions.
```
chore(monorepo): pins Bun to 1.4.2 in the root package.json
docs(monorepo): adds a contributing guide
ci(ci): runs the pull request title lint on every edit
```

### Don't

Use file names or paths as scopes — name the domain instead.
```
fix(src/utils/format.ts): returns an empty string for null input   # Wrong: use domain name
fix(format): returns an empty string for null input                # Correct
```

Use inconsistent names for the same package or domain — pick one and use it consistently.
```
feat(ds-button): adds an outline variant           # One commit says "ds-button"
fix(button): restores the hover state colour        # Another says "button"
```

Use overly broad scopes that don't narrow the change.
```
fix(app): rejects an empty postcode        # "app" is too broad
fix(checkout): rejects an empty postcode   # Specific domain
```

---

## Pull request template

**Identifier:** `cs:git.pr.template`

Every repository must have a pull request template that guides contributors toward consistent, reviewable PRs. The template must include a summary of changes, QA/testing steps, and a readiness checklist. The PR title must follow conventional commits format since it becomes the squashed commit message on main.

### Do

Place a PR template at `.github/PULL_REQUEST_TEMPLATE.md` covering summary, QA steps, and a readiness checklist.
```markdown
## Summary

[Describe what changed and why]

## QA

- [Steps to verify the change works correctly]

### Checklist

- [ ] PR title follows Conventional Commits format
- [ ] Tests pass locally
- [ ] New/changed behavior is covered by tests
```

Enforce PR title format with CI — for example using `amannn/action-semantic-pull-request`.
```yaml
# .github/workflows/pr-lint.yml
name: PR Lint
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  lint-title:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v6
```

Write a PR title that reads as a conventional commit since it will become the commit on main.
```
feat(search): add fuzzy matching
fix(auth): handle expired refresh tokens
chore(deps): bump vitest to 3.2
```

### Don't

Skip the PR template — without it, PRs lack structure and slow down reviews.
```markdown
<!-- Empty PR body -->
```

Write PR titles that don't follow conventional commits.
```
Add search feature             # Missing type prefix
feat - add search              # Wrong separator
FEAT(search): Add matching     # Wrong casing
```

Skip QA steps — reviewers need to know how to verify the change.
```markdown
## Summary
Added a thing

<!-- No QA section — reviewer has to guess how to test -->
```

---

## Protected, squash-merged main

**Identifier:** `cs:git.remote.main_branch`

The main branch must be protected and should maintain a clean, linear-ish history of meaningful commits. Pull requests must be squash-merged so that each PR becomes a single conventional commit on main. This keeps `git log` on main scannable, bisectable, and suitable for automated changelog generation. Branch protection rules must prevent direct pushes and require passing CI.

### Do

Enable branch protection on `main` requiring review, up-to-date passing status checks, and no direct pushes.
```yaml
# GitHub branch protection settings
require_pull_request:
  required_approving_review_count: 1
  dismiss_stale_reviews: true
require_status_checks:
  strict: true                    # Branch must be up-to-date before merge
  contexts: [ci/build, ci/test]   # Required checks must pass
restrict_direct_push: true        # No pushing directly to main
```

Configure squash merge as the default (or only) merge strategy.
```yaml
# Repository settings
allow_squash_merge: true
allow_merge_commit: false        # Disable merge commits
allow_rebase_merge: false        # Disable rebase merge
squash_merge_commit_title: PR_TITLE   # Use PR title as commit message
```

Ensure the squashed commit message follows conventional commits — the PR title becomes the commit on main.
```
feat(search): add fuzzy matching          ← PR title = commit on main
fix(auth): handle expired refresh tokens  ← PR title = commit on main
```

Use the PR description body for additional context that will appear in the commit body.
```
feat(search): add fuzzy matching

Implements Levenshtein distance with configurable threshold.
Falls back to exact match when no fuzzy results exceed the minimum score.
```

### Don't

Allow direct pushes to `main`.
```bash
# Bad: pushing directly to main
git push origin main
```

Use merge commits that pollute the main branch log.
```
Merge branch 'feat/search' into main      # Noise in git log
Merge pull request #42 from user/branch   # Not descriptive
```

Allow PRs to merge without passing CI.
```yaml
# Bad: no required status checks
require_status_checks: false
```

Squash-merge with an auto-generated message that doesn't follow conventional commits.
```
feat/search (#42)             # Wrong: not conventional
Add fuzzy matching (#42)      # Wrong: missing type prefix
```

---

## Repo-scoped gitignore

**Identifier:** `cs:git.repo.gitignore`

Every repository must have a `.gitignore` that prevents build artifacts, dependencies, environment files, and tool caches from being committed. The repo-level gitignore covers project-specific patterns only. OS and editor ignores belong in the user's global gitignore (`~/.config/git/ignore`), not in the repository.

### Do

Ignore build output and compilation artifacts.
```gitignore
dist/
build/
*.tsbuildinfo
storybook-static/
```

Ignore dependency directories.
```gitignore
node_modules/
.bundle/
vendor/
```

Ignore environment and secrets files.
```gitignore
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json
```

Ignore tool caches.
```gitignore
.nx/
.turbo/
.cache/
.parcel-cache/
```

Keep OS and editor ignores in the user's global gitignore (`~/.config/git/ignore`), not in the repo.
```gitignore
# ~/.config/git/ignore (global, per-user)
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
```

### Don't

Commit a repository without a `.gitignore` — anything can get tracked accidentally.

Put OS or editor patterns in the repo-level `.gitignore` — these are user-specific and belong in the global gitignore.
```gitignore
# Bad: in repo .gitignore
.DS_Store
Thumbs.db
.idea/
.vscode/settings.json
```

Track generated files that can be reproduced from source.
```gitignore
# Bad: committing coverage reports or build caches
coverage/
*.lcov
```

Track secrets or credentials under any circumstances.
```bash
# Bad: staging secret files
git add .env
git add deploy-key.pem
```

---

## Annotated SemVer release tags

**Identifier:** `cs:git.tag.versioning`

Release tags must follow semantic versioning prefixed with `v` (e.g. `v1.2.3`). Tags must be annotated (not lightweight) so they carry metadata for tooling. Pre-release versions use a hyphenated identifier after the patch number. Automated tooling (Lerna, changesets, etc.) should derive version bumps from conventional commit types: `feat` → minor, `fix` → patch, `BREAKING CHANGE` → major. Before 1.0, `!` bumps the minor; 1.0.0 is set by hand.

### Do

Use the `v` prefix with semantic versioning for tags.
```bash
git tag -a v1.0.0 -m "v1.0.0"
git tag -a v2.3.1 -m "v2.3.1"
```

Use annotated tags (not lightweight) so they carry author and message metadata.
```bash
# Annotated tag (correct)
git tag -a v1.0.0 -m "v1.0.0"

# Verify it's annotated
git cat-file -t v1.0.0   # → tag
```

Use pre-release identifiers for non-stable releases.
```bash
git tag -a v1.0.0-alpha.1 -m "v1.0.0-alpha.1"
git tag -a v1.0.0-beta.3 -m "v1.0.0-beta.3"
git tag -a v1.0.0-rc.1 -m "v1.0.0-rc.1"
git tag -a v2.0.0-experimental.5 -m "v2.0.0-experimental.5"
```

Let conventional commits drive version bumps.
```
feat → minor bump (1.0.0 → 1.1.0)
fix  → patch bump (1.0.0 → 1.0.1)
feat! / BREAKING CHANGE → major bump (1.0.0 → 2.0.0)
feat! / BREAKING CHANGE before 1.0 → minor bump (0.43.0 → 0.44.0)
```

### Don't

Use lightweight tags for releases — they carry no metadata and some tools ignore them.
```bash
# Bad: lightweight tag
git tag v1.0.0
```

Omit the `v` prefix or substitute a non-standard one.
```bash
git tag -a 1.0.0 -m "1.0.0"     # Wrong: missing v prefix
git tag -a release-1.0.0        # Wrong: non-standard prefix
```

Use non-semver version formats.
```bash
git tag -a v1.0 -m "v1.0"                 # Wrong: missing patch
git tag -a v2024.03.21 -m "v2024.03.21"   # Wrong: calver
git tag -a v1.0.0.1 -m "v1.0.0.1"         # Wrong: four segments
```

Manually decide version numbers when conventional commits can derive them.
```bash
# Bad: guessing the next version
git tag -a v1.3.0 -m "v1.3.0"   # Was this a feat or fix? Let tooling decide.
```

---

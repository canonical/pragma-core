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

Use imperative mood in the description — complete the sentence "this commit will...".

### Do

Structure commit messages as `type(scope): description`.
```
feat(auth): add OAuth2 login flow
fix(csv-export): handle UTF-8 BOM in output
chore(deps): bump vitest to 3.2
docs(api): document rate-limiting headers
refactor(router): extract middleware chain
test(auth): add integration tests for token refresh
ci(deploy): add staging environment workflow
perf(queries): add index for user lookup
```

Use imperative mood in the description — complete the sentence "this commit will...".
```
feat(button): add loading state        # "this commit will add loading state"
fix(form): prevent double submission   # "this commit will prevent double submission"
```

Add a body separated by a blank line for non-trivial changes, and a footer for breaking changes.
```
feat(api)!: change pagination response shape

The `results` field is now `items` and `total` is replaced by `hasMore`.
Clients must update their response handlers.

BREAKING CHANGE: pagination response fields renamed
```

Keep the subject line under 72 characters.
```
feat(search): add fuzzy matching with configurable threshold
```

### Don't

Write commit messages without a type prefix.
```
added search feature
fix bug in login
update dependencies
```

Use past tense or non-imperative mood.
```
feat(auth): added OAuth2 login       # Wrong: "added" → "add"
fix(form): fixed double submit       # Wrong: "fixed" → "prevent double submission"
feat(ui): adds loading spinner       # Wrong: "adds" → "add"
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
feat(search): add fuzzy matching with configurable threshold and fallback to exact match when score is below minimum
```

---

## Scope commits by package

**Identifier:** `cs:git.commit.scope`

The scope in a conventional commit should identify the package, module, or domain affected by the change. In a monorepo, the scope is typically the package name (without the namespace prefix). In a single-package repo, it is the module or feature area. Consistent scopes make `git log --grep` useful and enable per-package changelogs.

### Do

Use the package name (without namespace) as scope in a monorepo.
```
feat(button): add outline variant
fix(form-utils): handle empty field arrays
chore(cli): update bin entry point
```

Use the module or feature area as scope in a single-package repo.
```
feat(auth): add session refresh
fix(api): handle 429 rate-limit responses
refactor(router): split route definitions
```

Omit the scope for changes that span the whole project.
```
chore: update CI node version to 24
docs: add contributing guide
ci: add PR lint workflow
```

### Don't

Use file names or paths as scopes — name the domain instead.
```
fix(src/utils/format.ts): handle null input   # Wrong: use domain name
fix(format): handle null input                # Correct
```

Use inconsistent names for the same package or domain — pick one and use it consistently.
```
feat(ds-button): add variant        # One commit says "ds-button"
fix(button): fix hover state        # Another says "button"
```

Use overly broad scopes that don't narrow the change.
```
fix(app): fix validation        # "app" is too broad
fix(checkout): fix validation   # Specific domain
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

Release tags must follow semantic versioning prefixed with `v` (e.g. `v1.2.3`). Tags must be annotated (not lightweight) so they carry metadata for tooling. Pre-release versions use a hyphenated identifier after the patch number. Automated tooling (Lerna, changesets, etc.) should derive version bumps from conventional commit types: `feat` → minor, `fix` → patch, `BREAKING CHANGE` → major.

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

---
name: push-branch
description: Gets a branch push-ready in canonical/pragma-core or canonical/pragma-web and pushes it. Runs the root gate, fixes lint and coverage together, syncs with a moved main, pushes safely, and reads a failing CI run. Use before every push, and whenever CI fails on a pull request, in either pragma repository.
---

# Push a branch

Use this before every push in `canonical/pragma-core` or `canonical/pragma-web`, and when CI fails.

## Checklist

```
- [ ] 1. Sync with main
- [ ] 2. Run the root gate: check, then test
- [ ] 3. Push
- [ ] 4. Watch the CI run
```

## 1. Sync with main

Run `git fetch origin main`. When the branch is behind, bring `main` in:

- **A branch not yet pushed** is rebased onto `origin/main`. Tidy its history in the same pass (the `commit-changes` skill).
- **A branch that someone else builds on** — shared with another person, or part of a stack of pull requests — takes normal commits only: no amend, no rebase, no force-push. Bring `main` in as a merge commit. A stack of pull requests is linked as a GitHub stack (`gh stack`) and merged bottom-up; a branch higher in the stack picks up the one below it through a normal merge.
- **A pushed branch that nobody else builds on**: ask a maintainer before rebasing it. When they agree, push it with `git push --force-with-lease`, which refuses when someone else pushed to the branch meanwhile.
- **Resolve a `bun.lock` conflict by regenerating it** with the pinned Bun (the `change-dependencies` skill).

## 2. Run the root gate

Every edit, even a one-line fix, is installed and checked locally before it is pushed:

```bash
bun install          # when dependencies changed, or in a fresh worktree
bun run check        # lint, format, type-check and architecture rules, every package
bun run check:fix    # when check reports fixable issues; then run check again
bun run test         # tests, every package
bun run build        # only when the change affects build artifacts or a publishable package
```

- **A branch is push-ready when `bun run check` and `bun run test` pass from the repository root**, after the sync, not only before it. CI runs every affected package, so a change can break a package you did not touch through a shared configuration, a Biome version or a coverage gate. Running one package's scripts from its own folder is a fast loop, not the gate.
- **Satisfy lint and coverage together.** Do not trade one for the other, for example with a `!` non-null assertion that drops an uncovered `?? ""` branch. Rewrite the code so both pass.
- **Blame the environment only after the same failure reproduces on a clean `origin/main`.**
- **On a loaded machine, local tests can time out.** Re-run with a longer timeout or with `--concurrency 1`, and say which you did. CI is the verdict.
- **`.kb/this-repository.md` names any check the root gate does not cover here.**

## 3. Push

- Push with `git push -u origin <branch>`.
- Never push speculative "maybe this fixes CI" commits: fix the cause, run the gate, then push.
- Never use plain `--force`.

## 4. Watch the CI run

Green locally is necessary, not sufficient. When a job fails, read its log with `gh run view <id> --log-failed`, fix the cause at its source, and go back to step 2.

Then open or update the pull request (the `open-pull-request` skill).

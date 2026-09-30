---
name: change-ci
description: Changes CI in canonical/pragma-core or canonical/pragma-web. Covers why workflows stay global, where a package's check belongs, why CI never codes against a remote service, and the GitHub Actions traps in these repositories. Use before adding or changing a workflow, a composite action or CODEOWNERS, or before adding a check for one package, in either pragma repository.
---

# Change CI

Use this before changing anything under `.github/workflows/` or `.github/actions/`, or `CODEOWNERS`, in `canonical/pragma-core` or `canonical/pragma-web`, or before adding a check for a package.

## Where a check belongs

- **Workflows are global.** Never add a job or step for one package's concern. A required check applies to every pull request in the repository, including other teams' and outside contributors'. If one package's concern earns a step, every package's can, and the cost of one job is the precedent.
- **A package's check rides the package's own `check` and `test` scripts.** The root `check` and `test` fan out to every package, and CI runs them for every package Nx marks affected. That is cheaper and scoped correctly.
- **A shared step needs a genuine repository-wide invariant.** `scripts/check-workspace-ranges.ts` earns its step because it asserts something true of every workspace sibling. One package's concern does not, however important that package is.
- **A workflow carries no guard on the repository's own identity**, such as refusing to release unless the repository has a certain name.
- **A workflow change says why in the pull request body**, and expects to be challenged.

## No coding against remote services

A workflow does not poll, wait for, retry against, verify against or reconcile with a remote service such as the npm registry. The tool's own exit code is the verdict, and the recovery from a failed run is re-running it. For example, the release publishes with `lerna publish from-package`: a re-run publishes only what npm lacks, and does nothing after a full publish. Prevent a problem where it is authored rather than adding steps that detect and repair it afterwards.

## Traps

- **The pull request run covers only the Nx-affected projects; the run on `main` covers everything.** A green pull request, including a Renovate auto-merge, can still break `main`. Before merging a change that reaches every package, run the root gate locally, which covers every package.
- **A reusable workflow receives an environment's secrets only when its caller passes `secrets: inherit`.**
- **A push or pull request made with the workflow's own `GITHUB_TOKEN` starts no workflow.** A bot pull request that needs CI is opened with another token, such as a personal access token or a GitHub App token.
- **Auto-merge needs a required status check**, or it merges before CI finishes. The paths a bot writes have no code owner, because a bot never gets a code-owner review.
- **Pin every action to a full commit SHA**, with the version in a trailing comment (`uses: actions/checkout@<sha> # v7`). pragma-core's repository settings refuse anything else.
- **A YAML `run:` value that contains `": "` breaks parsing.** Write it as a block scalar (`run: |`).
- **The link check names `./.kb/**/*.md` explicitly.** lychee's `--hidden` flag would also scan `.github/`.

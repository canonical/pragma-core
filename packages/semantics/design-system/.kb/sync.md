# Preface

How the Coda sync regenerates this package's `data/` and `anatomies/census.json`: how it lands, what it skips and reports, and what still blocks it. Read this before changing the sync workflows or the transform, or when reading the result of a sync run.

Read the top-level `.kb/agents.md` file before continuing below.

# Overview

The sync reads the design-system document in Coda, regenerates `data/` and `anatomies/census.json`, and opens a pull request that merges itself (squash) once the required checks are green. `sync-coda.yml` does the work; `sync-coda-scheduled.yml` runs it daily and `sync-coda-manual.yml` runs it by hand. It runs in the `sync` environment, which holds the Coda key (`SUPERHUMAN_DOCS_API_KEY`) and the token that opens the pull request (`SUPERHUMAN_DOCS_SYNC_TOKEN`, a personal access token, because a pull request opened with the workflow's own token starts no CI).

# Important

- **A malformed or untypable row never blocks the sync.** It is left out of `data/` and listed under "Left out of `data/`" in the run summary and in the sync pull request, to be fixed at the source. Scheduled runs pass `allow_malformed_rows: true`, and manual runs default to it.
- **An anatomy that does not parse is skipped and reported, on every run until it parses.** There is no switch for this.
- **Every other guard still blocks the sync**: content loss, unresolved symbols, broken references and missing tables. A blocked sync is reported in the run summary, never as a GitHub issue.
- **A row's `uri` is built from other columns** (tier, block type, name). An empty `..` segment in it means a column that feeds it is blank or dangling: fix that column, in Coda.
- **The paths the sync writes have no code owner** (`CODEOWNERS`), so its pull request merges without waiting for a review. A path the sync starts writing is added there the same way.
- **The Figma thumbnail links in `data/` expire after seven days** and carry Figma's AWS key ID, not a secret. A secret scanner flags them; that is expected.

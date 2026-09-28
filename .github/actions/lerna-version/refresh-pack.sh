#!/bin/bash

# Refreshes the CLI's embedded pack so a release ships a graph snapshot current
# with its own tag.
#
# In `pragma` this was BEST EFFORT and token-gated: the declared pack sources
# were internal repositories cloned over HTTPS, the version job's SSH deploy key
# was scoped to pragma alone, and without a token that could read them the clone
# died with `could not read Username for 'https://github.com'` — which blocked
# the whole 0.35.0 release for an artifact that was already committed and
# already valid.
#
# In `pragma-core` neither half of that is true any more:
#
#   - the four absorbed packs (design-system, anatomy-dsl, token-ontology,
#     code-standards) are WORKSPACE MEMBERS, linked into node_modules, and the
#     bundler resolves them there through `SOURCE_OVERRIDES` in
#     packages/cli/pragma/scripts/embedSources.ts;
#   - the fifth, ds-implementations, is a PUBLIC repository.
#
# So there is nothing left to authenticate, the step is unconditional again, and
# a real failure fails the release — the behaviour this script's own comment
# asked for "once a token that can read them exists".

set -euo pipefail

summary="${GITHUB_STEP_SUMMARY:-/dev/null}"

cd packages/cli/pragma
bun run bundle

{
  echo "### Embedded pack: refreshed"
  echo
  echo "Rebuilt from the declared pack sources. The manifest's contentHash is the"
  echo "verdict: an unchanged hash means no upstream movement. The generated files"
  echo "still churn on every run (blank-node labels and createdAt are not stable), so"
  echo "a diff here is NOT evidence of upstream movement — compare the hash."
} >> "$summary"

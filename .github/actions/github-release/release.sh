#!/bin/bash
set -euo pipefail

# Creates the GitHub Release for a tag, with notes generated from its commits.
#
# INPUTS:
# $1: version (required) - The released version number, without tag prefix.
# $2: tag_prefix (optional) - Prefix for the git tag. Default is "v".
#
# Requires: GH_TOKEN with contents:write, gh CLI, the tag to exist.

if [ -z "${1:-}" ]; then
  echo "Error: version argument is required."
  exit 1
fi

version="$1"
tag_prefix="${2:-v}"
tag="${tag_prefix}${version}"

# Create the release for the tag unless it exists (idempotent for publish-job
# re-runs).
if gh release view "$tag" > /dev/null 2>&1; then
  echo "Release $tag already exists."
else
  gh release create "$tag" --verify-tag --generate-notes
fi

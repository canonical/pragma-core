# Preface

How the `pragma` command-line tool ships the design-system graph: the declared packs, the embedded snapshot, and the check that keeps them in step. Read this before changing a design-system model under `packages/semantics/`, the tool's pack configuration, or the embedded snapshot.

Read the top-level `.kb/agents.md` file before continuing below.

# Overview

The design-system knowledge graph is assembled from packs: the design-system, anatomy, token-ontology and code-standards models under `packages/semantics/`, and the implementations pack, which is read from `canonical/pragma-web`. `packages/cli/pragma/pragma.conf.ts` declares which packs the tool uses and where each comes from.

The tool answers store-backed reads offline from a committed snapshot of those packs, the `*.generated.ts` files in `packages/cli/pragma/src/kernel/runtime/graphpack/embedded/`. The snapshot's manifest records where each pack was resolved from. The release workflow rebuilds the snapshot, so a release ships a graph current with its own tag.

# Important

- **Never edit the embedded `*.generated.ts` files by hand.** Rebuild them with `bun run bundle` from `packages/cli/pragma`.
- **`check:packs` guards the snapshot.** It runs in the package's own `check` and its test suite runs in the package's `test`, so the root gate covers it. It fails when the snapshot cannot be shown to match the declared sources: a pack pinned to a tag or commit must record exactly that commit, and every declared pack must have one provenance entry.
- **The parity check stays a package concern.** It lives in the package's `scripts/` and rides the package's targets; it does not earn a shared workflow step ([`docs/contributing/ci.md`](../docs/contributing/ci.md#where-a-check-belongs)).
- **Every declared pack follows `main`**, the code-standards pack included. None is pinned to a release tag, so `sources update` gives users each pack as it is on `main`.

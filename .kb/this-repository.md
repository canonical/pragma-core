# Preface

What is specific to `canonical/pragma-core`: its domains, where its conventions are documented, and which topic files hold the rules that apply only here. Read this after the root `AGENTS.md`, before changing anything in this repository.

Read the top-level `.kb/agents.md` file before continuing below.

# Overview

`canonical/pragma-core` is the Canonical toolchain repository: the command-line tools, the code generators, the knowledge engine, the design tokens, the design-system models and the shared configurations that `canonical/pragma-web` and other projects consume from npm.

Most conventions here are documented. The domain map and the monorepo mechanics are in [`docs/explanations/DOMAINS.md`](../docs/explanations/DOMAINS.md); the GitHub settings, the rules for `main` and the secrets are in [`docs/references/REPOSITORY.md`](../docs/references/REPOSITORY.md).

# Architecture

Every folder under `packages/`, and `configs/`, is a domain (a concern), and a package belongs to exactly one. Each domain has an entry rule: `configs` (configuration other packages extend), `tools` (checks and maintenance tools that builds run on our own code), `shared` (libraries with no domain of their own, used by at least two domains), `tokens` (design values and their build), `engine` (storing and querying knowledge), `integrations` (adapters to third-party tools and services), `semantics` (the design system's models: ontologies, data, skills), `summon` (code generation, its engine and generators) and `cli` (the commands people and agents use to reach the system).

# Important

- Before adding a package, read [`docs/explanations/DOMAINS.md`](../docs/explanations/DOMAINS.md): it states what each domain does and does not hold, and names each package on npm beside its folder.
- Before changing a generator or its templates, read `.kb/summon.md`: generators return data, and they write file content from `.ejs` templates.
- Before changing a design-system model under `packages/semantics/`, or the `pragma` command-line tool's pack configuration, read `.kb/graph-packs.md`: the tool ships a generated snapshot of the graph packs, and a parity check guards it.
- Before changing anything that reaches the `pragma` command-line tool's performance tests, read `.kb/perf-budget.md`: that pass is kept off CI.
- Before adding a new package, read `.kb/publishing.md`: its first publish and its trusted-publisher setup are manual steps a human takes.

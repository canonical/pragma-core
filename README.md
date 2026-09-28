# pragma-core

The **Canonical toolchain**: two command-line tools, the knowledge engine they run on, the code
standards, the semantic models of the design system, and the design tokens. Everything here is
published to npm under `@canonical/*`, and everything here is consumed by
[`canonical/pragma-web`](https://github.com/canonical/pragma-web) — the React, Svelte and Lit
component packages, the stylesheets and the applications — as ordinary pinned dependencies.

The split is by concern: **core produces the toolchain and the vocabulary; web renders.**

## Quick start

```bash
bun install          # Bun is required; the version is pinned in .bun-version
bun run check        # lint, format, type-check and the architecture rules, every package
bun run test         # every package's tests
bun run build        # the dev/link build
```

Node `^22.13.0 || ^24.0.0 || ^26.0.0` must also be present — the range Lerna requires and the range
the gate runs under. Use the command-line tool without cloning anything:

```bash
bunx @canonical/pragma-cli --help
```

## The domains

Each folder is a **concern**, not a layer, with a one-sentence entry rule a package must satisfy to
go there. `docs/explanations/DOMAINS.md` is the worksheet — what each domain holds, what it does
not, and the npm name of every package beside its folder.

| Folder | Entry rule | Packages |
|---|---|---|
| `configs` | Configuration other packages extend | biome, renovate and TypeScript configurations |
| `packages/tools` | Checks and maintenance tools builds run on our own code | `webarchitect`, the architecture linter |
| `packages/shared` | Libraries with no domain of their own, used by at least two domains | the task runner, the shared utilities |
| `packages/tokens` | Design values and their build | the DTCG token source, its types, its build plugin, its language server and VS Code extension |
| `packages/engine` | Storing and querying knowledge | the knowledge-engine compiler and its GraphQL layer |
| `packages/integrations` | Adapters to third-party tools and services | the AI-harness detection and MCP configuration |
| `packages/semantics` | The design system's models (ontologies, data, skills) | the `ds:` ontology and Coda-synchronised data, the anatomy DSL, the code-standards corpus, the `dt:` token ontology |
| `packages/summon` | Code generation, its engine and generators | `summon-core` and the generators |
| `packages/cli` | The commands people and agents use to reach the system | the `pragma` and `summon` binaries, and pragma's MCP server |

Four of these were copied in from repositories that are now archived. Their commit history stays
in those archives, read-only; this repository starts from a plain copy of each:

- **`packages/semantics/design-system`** (was `canonical/design-system`) — the `ds:` ontology, the
  component and UI-block specifications synchronised daily from Coda, the `collect` library, and the
  agent skills the command-line tool bundles.
- **`packages/semantics/anatomy-dsl`** (was `canonical/anatomy-dsl`) — the grammar for writing a
  component's anatomy as data, and the shapes that validate it.
- **`packages/semantics/code-standards`** (was `canonical/web-code-standards`) — the standards
  corpus, its ontology, the generated documentation and the `add-standard` skill.
- **`packages/tokens/*`** and **`packages/semantics/token-ontology`** (were `canonical/design-tokens`)
  — the DTCG token source and the built CSS, the Terrazzo CSS plugin, the token language server and
  its VS Code extension, and the token types; and the `dt:` semantic model of the tokens.

## Working across the two repositories

A change to a package in this list is a **`pragma-core` pull request**. `pragma-web` consumes these
packages from npm at exact versions, so a core change reaches web when core releases and Renovate
opens the bump — never by editing web.

## Contributing

`AGENTS.md` is the pull-request contract: the toolchain, the commit and branch conventions, the
pre-push gate and the release mechanics. `CONSTITUTION.md` holds the thirteen principles that govern
both repositories; this copy is the canonical one. `docs/references/REPOSITORY.md` records how the
repository is configured on GitHub: its settings, the rules for `main`, and where each secret lives.

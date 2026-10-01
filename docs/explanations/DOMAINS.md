# DOMAINS — what each folder in `pragma-core` holds

> **Companion:** `pragma-web`'s `docs/explanations/DOMAINS.md` does the same for the rendering half.

A domain is a **concern**, not a layer and not a product. A reader who wants "the token pipeline"
opens `packages/tokens/`; one who wants "the vocabulary the design system is written in" opens
`packages/semantics/`. A single-package domain is acceptable.

Each folder has an **entry rule**: the sentence a new package must satisfy to go there.

| Folder | Entry rule |
|---|---|
| `configs/` | configuration other packages extend |
| `packages/tools/` | checks and maintenance tools builds run on our own code |
| `packages/shared/` | libraries with no domain of their own, used by at least two domains |
| `packages/tokens/` | design values and their build |
| `packages/engine/` | storing and querying knowledge |
| `packages/integrations/` | adapters to third-party tools and services |
| `packages/semantics/` | the design system's models (ontologies, data) |
| `packages/summon/` | code generation, its engine and generators |
| `packages/cli/` | the commands people and agents use to reach the system |
| `packages/skills/` | agent skills, as packages |

The npm name is given beside every folder, because the two do not always match: the folder name is
the human coordinate and the npm name is the published one, and a later rename of either has to be
able to find the other. Every package sits exactly two levels under `packages/` (or one under
`configs/`), so a path relative to a package reaches the repository root the same way from each.

---

## `configs` — configuration other packages extend

| Folder | npm name |
|---|---|
| `configs/biome` | `@canonical/biome-config` |
| `configs/renovate` | `@canonical/renovate-config` |
| `configs/typescript` | `@canonical/typescript-config` |

**Belongs here:** a configuration that more than one package extends, published so that `pragma-web`
extends the same one.

**Does not belong here:** the framework-flavoured TypeScript configs (`typescript-config-react`,
`-svelte`, `-lit`) and `vitest-config-react`. They are web's, and they extend this one.

> The legacy `@canonical/typescript-config-base` and `@canonical/typescript-config-react` — from the
> long-gone `canonical/ds25` repository — are not published from here and are not used here. The
> absorbed packages that still named them were moved onto `@canonical/typescript-config` when they
> arrived.

---

## `packages/tools` — checks and maintenance tools builds run on our own code

| Folder | npm name |
|---|---|
| `packages/tools/webarchitect` | `@canonical/webarchitect` |

**Belongs here:** a tool that a package's `check`, `build` or release runs against this repository's
own code: `webarchitect`, the architecture linter that applies the rulesets. The monorepo's own
maintenance tools belong here too when they become packages.

**Does not belong here:** the standards themselves, stated as data: they are a model of the design
system and live in `packages/semantics/code-standards`. A command people run to reach the system is
`cli`.

---

## `packages/shared` — libraries with no domain of their own

| Folder | npm name |
|---|---|
| `packages/shared/task` | `@canonical/task` |
| `packages/shared/utils` | `@canonical/utils` |

**Belongs here:** a library that at least two domains import and that no single domain owns: the
task runner and the environment-agnostic utilities.

**Does not belong here:** a library only one domain uses (it lives in that domain), and anything that
assumes a browser or a component tree. The router and i18n cores, and the DOM-shaped helpers that
were once in `utils`, are `pragma-web`'s (`@canonical/router-core`, `@canonical/i18n-core`,
`@canonical/ds-utils`).

---

## `packages/tokens` — design values and their build

| Folder | npm name |
|---|---|
| `packages/tokens/tokens` | `@canonical/design-tokens` |
| `packages/tokens/types` | `@canonical/token-types` |
| `packages/tokens/plugin` | `@canonical/terrazzo-plugin-css` |
| `packages/tokens/lsp` | `@canonical/terrazzo-lsp` |
| `packages/tokens/lsp-extension` | `@canonical/terrazzo-lsp-extension` |

**Belongs here:** the DTCG token files and the CSS built from them, the Terrazzo plugin that does
the building, the language server and its VS Code extension, and the shared TypeScript types.
`packages/tokens/documentation/` is this domain's prose.

**Does not belong here:** the `dt:` ontology that models the tokens (`packages/semantics/token-ontology`:
a model, not a value), the stylesheets that *consume* the tokens (`@canonical/styles` and friends, in
`pragma-web`), and any React binding of them (`@canonical/react-tokens`, also web).

---

## `packages/engine` — storing and querying knowledge

| Folder | npm name |
|---|---|
| `packages/engine/ke` | `@canonical/ke` |
| `packages/engine/ke-graphql` | `@canonical/ke-graphql` |

**Belongs here:** the knowledge-engine compiler and store, and the GraphQL layer that queries it.

**Does not belong here:** the knowledge itself (the models are `semantics`), and the commands that
read it (`cli`).

---

## `packages/integrations` — adapters to third-party tools and services

| Folder | npm name |
|---|---|
| `packages/integrations/harnesses` | `@canonical/harnesses` |

**Belongs here:** code whose job is to speak to a tool or service outside this repository: the
harness detection and MCP configuration for the AI coding tools (Claude Code, Cursor, Windsurf and
the others).

**Does not belong here:** a library that happens to call a third-party package in passing; the
adapter is the package's purpose, not a detail of it.

---

## `packages/semantics` — the design system's models

| Folder | npm name |
|---|---|
| `packages/semantics/design-system` | `@canonical/design-system` |
| `packages/semantics/anatomy-dsl` | `@canonical/anatomy-dsl` |
| `packages/semantics/code-standards` | `@canonical/code-standards` |
| `packages/semantics/token-ontology` | `@canonical/token-ontology` |

**Belongs here:** the models that say what a design-system entity *is*, independent of any
implementation of it: the `ds:` ontology, the component and UI-block specifications synchronised from
Coda into `data/`, the `collect` library, the grammar (plus validating shapes) for writing a
component's anatomy as data, the code-standards corpus (its ontology and the generated
documentation), and the `dt:` ontology that models the design tokens.

**Does not belong here:** the *implementation* graph — which React or Svelte component realises
which specification. That is collected from the annotations in the component packages and lives in
`pragma-web` as `@canonical/ds-implementations`. Nor do the agent skills that teach these models:
they are `skills`.

---

## `packages/summon` — code generation, its engine and generators

| Folder | npm name |
|---|---|
| `packages/summon/core` | `@canonical/summon-core` |
| `packages/summon/application` | `@canonical/summon-application` |
| `packages/summon/component` | `@canonical/summon-component` |
| `packages/summon/monorepo` | `@canonical/summon-monorepo` |
| `packages/summon/package` | `@canonical/summon-package` |

**Belongs here:** the generator runtime, and one package per thing that can be scaffolded.

**Does not belong here:** the `summon` binary itself (`packages/cli/summon`). Note that
`summon-application` and `summon-component` emit *web* code — React, Svelte and Lit — while living
in core: they are generators, and a generator is toolchain no matter what its templates say.

---

## `packages/cli` — the commands people and agents use to reach the system

| Folder | npm name |
|---|---|
| `packages/cli/pragma` | `@canonical/pragma-cli` |
| `packages/cli/summon` | `@canonical/summon` |

**Belongs here:** a program with a `bin` entry that people or agents invoke, its command grammar,
and — for `pragma` — the MCP server projected from that same grammar and the embedded graph snapshot
it answers reads from offline.

**Does not belong here:** the libraries the binaries are built from. `pragma` compiles a knowledge
graph, but the compiler is `packages/engine/ke`; `summon` generates code, but the generator
framework is `packages/summon/core`. A binary is a surface over libraries, and stays thin enough to
say so. A tool that builds run on our own code (`webarchitect`) is `tools`, even though it has a
`bin`.

---

## `packages/skills` — agent skills, as packages

| Folder | npm name |
|---|---|
| `packages/skills/contribute` | `@canonical/skills-contribute` |
| `packages/skills/pragma` | `@canonical/skills-pragma` |

**Belongs here:** a package of agent skills — `skills/<name>/SKILL.md` folders — plus the tests that
check them. `skills-pragma` holds the skills people use through the `pragma` command-line tool, which
declares it as a pack and ships a snapshot of it.

**Does not belong here:** the models and data a skill teaches (they are `semantics`), and the
command that finds and installs skills (it is `cli`). A skills package holds no library code and no
graph data.

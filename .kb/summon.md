# Preface

How the `summon` code generators are built: the engine, the generator packages, and how a generator writes files. Read this before changing a generator, a template, or the engine under `packages/summon/`.

Read the top-level `.kb/agents.md` file before continuing below.

# Overview

`summon` is a code generator framework in which a generator is a pure function that returns data, not side effects. Its `generate` step returns tasks that describe "write this file"; an interpreter then runs them for real, previews them with `--dry-run`, or hands them to a test without mocks. The engine is `packages/summon/core` (`@canonical/summon-core`), the command-line tool is `packages/cli/summon` (`@canonical/summon`), and the generators live in their own packages under `packages/summon/` (`application`, `component`, `monorepo`, `package`). Each generator package lists the conventions its output follows in its `CONVENTIONS.md`, and the engine's tutorial, how-to guides, reference and explanation are in `packages/summon/core/docs/`.

# Important

- **Generators write file content from `.ejs` templates**, kept in a `templates/` directory beside the generator, never from TypeScript string builders.
- **Generated code has no privileged relationship to its generator.** A generated file is ordinary code that can be edited freely, and anything a generator produces can also be written by hand.

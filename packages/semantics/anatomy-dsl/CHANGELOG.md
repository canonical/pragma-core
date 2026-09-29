# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.43.0-experimental.1](https://github.com/canonical/pragma-core/compare/v0.43.0-experimental.0...v0.43.0-experimental.1) (2026-09-29)

**Note:** Version bump only for package @canonical/anatomy-dsl





# 0.43.0-experimental.0 (2026-09-29)

### Features

* **semantics:** add the token ontology, anatomy DSL, design system and code standards ([#11](https://github.com/canonical/pragma-core/issues/11)) ([69324c5](https://github.com/canonical/pragma-core/commit/69324c5093045e3c3dc6f77c3ebef567b86470eb))


# Changelog

Releases before 0.6.0 kept no changelog entry; `git log` is their record.
The version follows [semantic versioning](https://semver.org/), read against
what a consumer of this package depends on: the published TypeScript surface,
the definition files under `definitions/`, and whether an anatomy that was
valid stays valid.

## 0.6.0

Both changes are additive. No anatomy that validated against 0.5.1 fails
against 0.6.0, and no published export changes shape — so a minor.

### A style key may admit several token namespaces

`namespace` in `definitions/style-keys.yaml` took one dotted prefix. It now
takes one prefix or a list of them, and each member is projected into its
own three spellings — `N.`, `modifier.N.` and `surface.N.` — grouped by
namespace and in the order the roster states them. A scalar and a
one-element list mean the same thing, so every entry that stated one
namespace projects exactly what it projected before.

`anatomy:tokenNamespace` was already multi-valued, in the ontology and in
`definitions/registry.ttl`, and the `STYLE_KEYS` export already typed
`tokenNamespace` as `readonly string[]`. What changes is what those lists
can now hold: a key's namespaces rather than one key's namespace. A
consumer reading the list — design-system's `tokenNamespace` lookup is the
one — needs no change, because widening a declaration of which symbols a
key admits turns findings into admissions and never the reverse.

Every `spacing.*` key now admits `dimension.` alongside `spacing.`. The
implementations read `--dimension-*` directly for padding and gaps and the
semantic spacing namespace is still thin, so the roster admits both rather
than sending every real binding to the register. The second namespace is
marked temporary in the roster and comes out once semantic spacing lands.

### Three more interaction states

The closed state vocabulary gains `expanded`, `indeterminate` and
`invalid`, alongside `hover`, `active`, `focus`, `disabled` and `selected`:

- `expanded` — an `[open]` / `aria-expanded` disclosure state.
- `indeterminate` — a mixed checkbox or progress state, on neither setting.
- `invalid` — a failed-validation state (`:invalid`, `aria-invalid`).

The grammar is unchanged: a state is still a single `@state` suffix on a
style key, and the set is still closed and enforced by the shapes rather
than by the parser. Widening a closed `sh:in` cannot invalidate a document
that already conformed.

The API reference previously said structural states were excluded on
principle and named `expanded` as its example. It now states the line the
three sit on instead: a state is admitted where the implementation
re-values a channel in it, and refused where it changes what exists — so a
disclosure's panel is still a `switch`, and `open` is not admitted as a
second spelling of `expanded`.

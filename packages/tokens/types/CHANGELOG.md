# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.43.0-experimental.0 (2026-09-29)

### Features

* **tokens:** add the design tokens and their build and editor tooling ([#6](https://github.com/canonical/pragma-core/issues/6)) ([bca2af5](https://github.com/canonical/pragma-core/commit/bca2af534525025579b60a440c358f4a7a30886d))


# [0.10.0](https://github.com/canonical/design-tokens/compare/v0.9.1...v0.10.0) (2026-09-08)

**Note:** Version bump only for package @canonical/token-types





# [0.9.0](https://github.com/canonical/design-tokens/compare/v0.8.3...v0.9.0) (2026-09-06)

### Features

* **tokens:** add exact typography token plumbing ([#125](https://github.com/canonical/design-tokens/issues/125)) ([595d50e](https://github.com/canonical/design-tokens/commit/595d50ecad22d45d454f373a4eb5e45ec42a06be))


## [0.8.1](https://github.com/canonical/design-tokens/compare/v0.8.0...v0.8.1) (2026-07-19)

**Note:** Version bump only for package @canonical/token-types





# [0.8.0](https://github.com/canonical/design-tokens/compare/v0.7.0...v0.8.0) (2026-07-19)

**Note:** Version bump only for package @canonical/token-types





# [0.7.0](https://github.com/canonical/design-tokens/compare/v0.4.5...v0.7.0) (2026-07-19)


### Bug Fixes

* **lsp,plugin:** resolve critical, high, and medium review findings ([#74](https://github.com/canonical/design-tokens/issues/74)) ([b6d5640](https://github.com/canonical/design-tokens/commit/b6d5640306bc786d26b6171b493065d0ea88d20d))
* **lsp:** fix version.js crash in VS Code extension ([#53](https://github.com/canonical/design-tokens/issues/53)) ([f2b8a4c](https://github.com/canonical/design-tokens/commit/f2b8a4c491d572758050a97eed97cd34183d9619))


### Features

* **tokens,plugin:** add lifecycle and release modifier families ([#57](https://github.com/canonical/design-tokens/issues/57)) ([a0dbd11](https://github.com/canonical/design-tokens/commit/a0dbd118fd44d4d230914443828931a24d4cfb20))


### BREAKING CHANGES

* **lsp,plugin:** that needs broader stakeholder agreement on the canonical
naming convention. The number-primitive emission (C5) only resolves the
`--number-line-height-*` references *when* paired with the kebab change; on its
own it emits camelCase definitions that the kebab references do not match, so
it is parked together with C4.

Net effect: the dangling-reference elimination is deferred (the build again
has the pre-existing naming-mismatch dangling references). The other plugin
fixes in this PR are retained:
- theme `.light`/dark-scheme delta scoping (H11)
- deterministic typography / modifier-channel artifact provenance (H12, H13)

https://claude.ai/code/session_01R6S5ueSB86CiV2qyz4brYN

* fix(lsp): address PR review feedback

- isWithinRoot: use a separator-normalized root prefix so a workspace root that
  is the filesystem root ("/", or a Windows drive root) no longer rejects every
  in-root path (resolveConfig + resolveImportSpecifier).
- didChange diagnostics: bail after the awaited reindex when the document is no
  longer open, and delete its revision entry on close, so a pass that was
  in-flight when the document closed cannot publish diagnostics for a closed
  document (and docVersions no longer grows across open/close cycles).
- startLspServer: drop the initialize exemption and reply to any failed request
  (id present) with a JSON-RPC InternalError frame, so an initialize that throws
  inside createGraphWorker can no longer hang the client. Adds sendError() to
  the stdio transport.

https://claude.ai/code/session_01R6S5ueSB86CiV2qyz4brYN





# 0.4.0 (2026-03-18)


### Bug Fixes

* **extension:** chains vsix extension build to lsp build ([#45](https://github.com/canonical/design-tokens/issues/45)) ([7dc7cdd](https://github.com/canonical/design-tokens/commit/7dc7cdd23164c3657973a775f0cd83640d4601cf))
* **lsp:** completion and build ([#41](https://github.com/canonical/design-tokens/issues/41)) ([10f4708](https://github.com/canonical/design-tokens/commit/10f4708164c199bb60b7d47dc031118029e81c41))


### Features

* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))





# 0.3.0 (2026-03-18)


### Bug Fixes

* **lsp:** completion and build ([#41](https://github.com/canonical/design-tokens/issues/41)) ([10f4708](https://github.com/canonical/design-tokens/commit/10f4708164c199bb60b7d47dc031118029e81c41))


### Features

* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))





# 0.2.0 (2026-03-18)


### Bug Fixes

* **lsp:** completion and build ([#41](https://github.com/canonical/design-tokens/issues/41)) ([10f4708](https://github.com/canonical/design-tokens/commit/10f4708164c199bb60b7d47dc031118029e81c41))


### Features

* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))





# 0.1.0 (2026-03-11)


### Features

* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))

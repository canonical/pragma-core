# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.43.0-experimental.1](https://github.com/canonical/pragma-core/compare/v0.43.0-experimental.0...v0.43.0-experimental.1) (2026-09-29)

**Note:** Version bump only for package @canonical/terrazzo-plugin-css





# 0.43.0-experimental.0 (2026-09-29)

### Features

* **tokens:** add the design tokens and their build and editor tooling ([#6](https://github.com/canonical/pragma-core/issues/6)) ([bca2af5](https://github.com/canonical/pragma-core/commit/bca2af534525025579b60a440c358f4a7a30886d))


# [0.10.0](https://github.com/canonical/design-tokens/compare/v0.9.1...v0.10.0) (2026-09-08)

**Note:** Version bump only for package @canonical/terrazzo-plugin-css





# [0.9.0](https://github.com/canonical/design-tokens/compare/v0.8.3...v0.9.0) (2026-09-06)

### Bug Fixes

* **tokens:** address baseline spacing review ([24c7818](https://github.com/canonical/design-tokens/commit/24c781829718c001d8b8731b0fcecf866ca79c1f))
* **tokens:** let disabled text follow the surface, so it is not drawn on itself ([#127](https://github.com/canonical/design-tokens/issues/127)) ([d2de209](https://github.com/canonical/design-tokens/commit/d2de20956fc74991bb42757a0b8ce79b06a45dd4)), closes [#124](https://github.com/canonical/design-tokens/issues/124)
* **tokens:** make the on-foreground-secondary override actually resolve ([#129](https://github.com/canonical/design-tokens/issues/129)) ([892ffcf](https://github.com/canonical/design-tokens/commit/892ffcf13e66c90ae882c4f4c84fe6c34491edc3))

### Features

* **tokens:** add baseline and component spacing ([4953273](https://github.com/canonical/design-tokens/commit/4953273acd8188baac5ab10042d66a03f02eb26a))
* **tokens:** add exact typography token plumbing ([#125](https://github.com/canonical/design-tokens/issues/125)) ([595d50e](https://github.com/canonical/design-tokens/commit/595d50ecad22d45d454f373a4eb5e45ec42a06be))
* **tokens:** add foreground-primary and text-onForegroundSecondary channels to criticality modifier ([#104](https://github.com/canonical/design-tokens/issues/104)) ([1908fa8](https://github.com/canonical/design-tokens/commit/1908fa8d9c3759f27722d1d75ec55970175d6405))
* **tokens:** close the $root remedies — N1 and N2, as one change ([#120](https://github.com/canonical/design-tokens/issues/120)) ([cd54fbf](https://github.com/canonical/design-tokens/commit/cd54fbfe32323ff230a3de87a8d55668d05612ad)), closes [#104](https://github.com/canonical/design-tokens/issues/104)
* **tokens:** declare the surface emission set in the CSS profile ([#119](https://github.com/canonical/design-tokens/issues/119)) ([b42ba85](https://github.com/canonical/design-tokens/commit/b42ba8582542b801bcf1e9ccae7124c2147cd487))
* **tokens:** make the contracts and the CSS profile configuration ([#115](https://github.com/canonical/design-tokens/issues/115)) ([e087585](https://github.com/canonical/design-tokens/commit/e087585d4d1a4b0a314c023ad00e290a678331b9))


## [0.8.2](https://github.com/canonical/design-tokens/compare/v0.8.1...v0.8.2) (2026-08-27)

**Note:** Version bump only for package @canonical/terrazzo-plugin-css





## [0.8.1](https://github.com/canonical/design-tokens/compare/v0.8.0...v0.8.1) (2026-07-19)

**Note:** Version bump only for package @canonical/terrazzo-plugin-css





# [0.8.0](https://github.com/canonical/design-tokens/compare/v0.7.0...v0.8.0) (2026-07-19)


### Features

* **tokens:** add contrasted and modal surface contexts (experimental) ([#89](https://github.com/canonical/design-tokens/issues/89)) ([df3b62a](https://github.com/canonical/design-tokens/commit/df3b62a8e99d1e695707b9eb5b49e44f8986c8e1))





# [0.7.0](https://github.com/canonical/design-tokens/compare/v0.4.5...v0.7.0) (2026-07-19)


### Bug Fixes

* **lsp,plugin:** resolve critical, high, and medium review findings ([#74](https://github.com/canonical/design-tokens/issues/74)) ([b6d5640](https://github.com/canonical/design-tokens/commit/b6d5640306bc786d26b6171b493065d0ea88d20d))
* **lsp:** fix version.js crash in VS Code extension ([#53](https://github.com/canonical/design-tokens/issues/53)) ([f2b8a4c](https://github.com/canonical/design-tokens/commit/f2b8a4c491d572758050a97eed97cd34183d9619))
* **tokens:** singular typography context selectors + emit font-variant from $extensions ([#93](https://github.com/canonical/design-tokens/issues/93)) ([4c1d288](https://github.com/canonical/design-tokens/commit/4c1d288663432970b8ac6915b17b92d2a0340c60))
* update token mappings and add missing tokens ([#79](https://github.com/canonical/design-tokens/issues/79)) ([7c574fa](https://github.com/canonical/design-tokens/commit/7c574faacd366ea22d458a813545b5b2f04c72bb))


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


### Features

* **build:** pt3, plugin ([#20](https://github.com/canonical/design-tokens/issues/20)) ([6625432](https://github.com/canonical/design-tokens/commit/6625432ffd15e2e2b7ba7f48190463df66f04901))
* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))





# 0.3.0 (2026-03-18)


### Features

* **build:** pt3, plugin ([#20](https://github.com/canonical/design-tokens/issues/20)) ([6625432](https://github.com/canonical/design-tokens/commit/6625432ffd15e2e2b7ba7f48190463df66f04901))
* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))





# 0.2.0 (2026-03-18)


### Features

* **build:** pt3, plugin ([#20](https://github.com/canonical/design-tokens/issues/20)) ([6625432](https://github.com/canonical/design-tokens/commit/6625432ffd15e2e2b7ba7f48190463df66f04901))
* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))





# 0.1.0 (2026-03-11)


### Features

* **build:** pt3, plugin ([#20](https://github.com/canonical/design-tokens/issues/20)) ([6625432](https://github.com/canonical/design-tokens/commit/6625432ffd15e2e2b7ba7f48190463df66f04901))
* **build:** pt4, lsp ([#19](https://github.com/canonical/design-tokens/issues/19)) ([71ceb16](https://github.com/canonical/design-tokens/commit/71ceb168692381aa0d39b825673e9534dd29c7c6))
* **build:** pt5, monorepo alignment ([#21](https://github.com/canonical/design-tokens/issues/21)) ([23efced](https://github.com/canonical/design-tokens/commit/23efced1fb08cd32e382c7daac7702a9d6a6fd0b))

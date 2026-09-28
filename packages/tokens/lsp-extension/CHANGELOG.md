# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.10.0](https://github.com/canonical/design-tokens/compare/v0.9.1...v0.10.0) (2026-09-08)

**Note:** Version bump only for package @canonical/terrazzo-lsp-extension





## [0.9.1](https://github.com/canonical/design-tokens/compare/v0.9.0...v0.9.1) (2026-09-06)

### Bug Fixes

* **lsp-extension:** keep @types/vscode within the declared VS Code floor ([#133](https://github.com/canonical/design-tokens/issues/133)) ([0478ddb](https://github.com/canonical/design-tokens/commit/0478ddb597c8972f28b8dfc70cdf205ba6ccf858))


# [0.9.0](https://github.com/canonical/design-tokens/compare/v0.8.3...v0.9.0) (2026-09-06)

**Note:** Version bump only for package @canonical/terrazzo-lsp-extension





## [0.8.3](https://github.com/canonical/design-tokens/compare/v0.8.2...v0.8.3) (2026-08-27)


### Bug Fixes

* **lsp-extension:** bundle the language server so the packaged build can run ([#110](https://github.com/canonical/design-tokens/issues/110)) ([17b5ade](https://github.com/canonical/design-tokens/commit/17b5ade51af6eb01a60513d08674dbd45adb93ac))





## [0.8.2](https://github.com/canonical/design-tokens/compare/v0.8.1...v0.8.2) (2026-08-27)


### Bug Fixes

* **lsp-extension:** create a LogOutputChannel so the client can start ([#109](https://github.com/canonical/design-tokens/issues/109)) ([98df1d9](https://github.com/canonical/design-tokens/commit/98df1d99b57e437637a64d596ba0b2f9c19f65de))





## [0.8.1](https://github.com/canonical/design-tokens/compare/v0.8.0...v0.8.1) (2026-07-19)

**Note:** Version bump only for package @canonical/terrazzo-lsp-extension





# [0.8.0](https://github.com/canonical/design-tokens/compare/v0.7.0...v0.8.0) (2026-07-19)


### Features

* **tokens:** add contrasted and modal surface contexts (experimental) ([#89](https://github.com/canonical/design-tokens/issues/89)) ([df3b62a](https://github.com/canonical/design-tokens/commit/df3b62a8e99d1e695707b9eb5b49e44f8986c8e1))





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





## [0.4.6](https://github.com/canonical/design-tokens/compare/v0.4.5...v0.4.6) (2026-03-24)

**Note:** Version bump only for package @canonical/terrazzo-lsp-extension





# 0.4.0 (2026-03-18)

**Note:** Version bump only for package @canonical/terrazzo-lsp-extension

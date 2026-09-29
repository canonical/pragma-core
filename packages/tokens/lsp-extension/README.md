# Terrazzo LSP

Terrazzo LSP adds CSS custom property intelligence for Canonical design token workflows in VS Code.

## Features

- Completions for `var(--token)` references
- Hover details with resolved token values and provenance
- Diagnostics for missing fallbacks, stale fallbacks, primitive token use, and type mismatches
- Go to definition and rename for custom properties
- Workspace symbol search across token names

## Quick start

1. Install `@canonical/design-tokens` in your project.
2. Run `npx @canonical/terrazzo-lsp-extension` to install the extension.
3. Create a `terrazzo-lsp.config.json` file in your workspace root:

```json
{
  "artifacts": ["@canonical/design-tokens/dist/tokens.json"]
}
```

## Configuration

### `terrazzo-lsp.serverPath`

Optional path to a custom `dist/esm/cli.js` server build.

### `terrazzo-lsp.runtime`

Optional runtime override. Leave empty to auto-detect `bun` first and `node >= 22` second.

### `terrazzo-lsp.trace.server`

Controls the VS Code language client trace level.

## Monorepos and multi-folder workspaces

The LSP loads its configuration once, based on the first CSS or SCSS file
you open. In a monorepo with multiple packages, open a file from the
package that contains `terrazzo-lsp.config.json` first. Alternatively,
place the config at the workspace root so it is reachable from any package.

If the first file opened lives in a folder without a config, the server
enters degraded mode — it stays alive but provides no token intelligence
until VS Code is reloaded with a config-bearing file opened first.

## Troubleshooting

If the extension cannot find a runtime, install `bun` or `node >= 22`, or set `terrazzo-lsp.runtime` explicitly in your workspace settings.

If no `terrazzo-lsp.config.json` is present, the extension output logs the
candidate paths it tried and includes a starter example you can paste into a
new config file.

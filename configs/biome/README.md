# @canonical/biome-config

This is a [Biome](https://biomejs.dev/) configuration that provides 
a set of default configurations for Biome projects.

## Install

1. Install [Biome](https://biomejs.dev/): `bun add -d @biomejs/biome`
2. Install configuration: `bun add -d @canonical/biome-config`

## Consume

Create `biome.json` in the root of your project and extend this configuration.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.11/schema.json",
  "extends": [
    "@canonical/biome-config"
  ],
  "files": {
    "includes": [
      "src",
      "*.json"
    ]
  }
}
```
Run `biome` commands as usual. The base configuration will be applied.

Example `package.json` scripts are provided below.

```jsonc
{
  "scripts": {
    "check": "biome check",
    "format": "biome format",
    "lint": "biome lint"
  }
}
```

## Configuration

This configuration enables the following behavior:

1. Formatting Rules
   1. Two-space indentation
   2. Double-quote strings
2. Organized imports
3. Apply Biome's recommended linting rules by default
4. Disable version control integration: no interaction with Git
   1. Ignores `.gitignore`: Explicitly includes all files unless they are ignored manually or other files are included explicitly.
   2. Ignores Git add status: No need to stage files before running `biome check` or `biome format`.
5. Excludes files with idiomatic `files.includes` patterns:
   1. `node_modules` is already ignored by Biome's defaults, so it is not listed.
   2. Build output (`dist`, `storybook-static`, `coverage`, `.build-cache`) uses Biome's force-ignore form (`!!`), so these directories are never scanned or indexed.
   3. Generated source (`*.gen.ts`) is a regular exclusion (`!`), so it stays indexed and can provide types to the module graph.
   4. A consumer that sets its own `files.includes` replaces this array entirely (Biome 2 extension is not transitive for `files.includes`), so list every pattern it needs.
   
### Caveats
#### Monorepos
Biome does not yet fully support monorepos. 
Biome and IDE plugins that use it may not work as expected if you are working in a monorepo.
As a work-around, [Biome suggests](https://biomejs.dev/guides/big-projects/#monorepos) including a `biome.json` at the 
root of a monorepository, and using `overrides` to specify any exceptions for sub-packages.

#### Language support
Biome is still in development and may not support all languages or features.
We recommend checking the [Biome supported languages list](https://biomejs.dev/internals/language-support/) 
to ensure that your project is supported.

##### Svelte
We include Svelte-specific overrides because Biome does not yet support "cross-language" lint behavior, which can produce false positives for `noUnusedVariables`, `noUnusedImports`, `useImportType`, and `useConst`.

These lint overrides are temporary and should be removed once [biomejs/biome#8590](https://github.com/biomejs/biome/issues/8590) is resolved.

We keep these overrides directly in `@canonical/biome-config` (rather than in a separate Svelte-specific config package) because Biome config extension is not transitive. For additional context, see [PR #449](https://github.com/canonical/pragma-web/pull/449).

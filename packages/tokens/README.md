# @canonical/design-tokens

Design tokens for the Canonical design system, with a Terrazzo CSS plugin and a language server providing CSS custom property intelligence. Token definitions follow the [DTCG Community Group](https://www.designtokens.org/tr/2025.10/format/) specification.

## Design Principles

This repository is **fully compliant with the Design Tokens specification** (Final
Community Group Report 2025.10 — the format, color, and resolver modules) at the
source layer, while deliberately choosing a different **delivery model** than the
specification's default consumption pipeline. The difference is one of
expressibility, justified by the domain-driven modifier model: modifier families
(mode, surface, anticipation, criticality, …) are domain dimensions along which
token values vary, and the delivered output keeps those dimensions **permutable
at runtime** instead of flattening them away at build time.

### Compliance at the source

Token documents and the resolver use only constructs the specification defines.
Any conformant DTCG tool can resolve this repository's source, permutation by
permutation, and obtain the intended values. The specification's resolution
logic — ordered merge, references resolved after flattening — is the
per-permutation ground truth for everything the build produces.

```jsonc
// A token, an alias, and a resolver context — nothing beyond the specification.
// tokens file:
"brand": { "primary": { "$value": "{color.palette.orange.398}" } }
// resolver:
"theme": { "contexts": {
    "light": [{ "$ref": "global/semantic/color/light.tokens.json" }],
    "dark":  [{ "$ref": "global/semantic/color/dark.tokens.json" }] } }
```

### A factorized, runtime-permutable delivery

A resolver describes how token values vary: a *theme* modifier gives every
colour a light and a dark value, an *anticipation* modifier turns interactive
colours green during constructive actions, and so on. The specification's
default way of consuming this is to **flatten**: you pick one context per
modifier (say `theme: dark`), the tool merges the files in order, and out comes
one finished list of values — a `dark.css`. Want light too? Run it again. Want
dark *while compact* *while in an error state*? Each combination you need is
another build output.

This repository consumes the same source differently. The build emits **one
output that contains every variant at once**, written so that the browser picks
the right value at render time: base values carry both themes via
`light-dark()`, and each modifier contributes its overrides under a class
selector. Switching theme or state never loads a different file — a class is
toggled, or a user preference applies, and the CSS cascade re-resolves on the
spot.

The same variation, in both output styles:

```css
/* Default consumption — one file per combination */
/* light.css */  :root { --color-text: #000; }
/* dark.css  */  :root { --color-text: #fff; }

/* This repository — one output, resolved by the browser */
:root  { --color-text: light-dark(#000, #fff); }
.error { --modifier-color-text: var(--color-text-error); }
```

The consequences, side by side:

| | Default consumption | This repository |
|---|---|---|
| The source files | DTCG token files + resolver | identical — no difference at all |
| What the build produces | one finished value-list per combination of contexts (`light.css`, `dark.css`, `dark-compact.css`, …) | one set of files describing every variant at once |
| When a token gets its final value | at build time, decided by the tool | at render time, decided by the browser (the CSS cascade) |
| As variants multiply | outputs multiply: 2 themes × 2 densities × 4 states = 16 builds | output stays one: each dimension only adds its own part |
| How an app switches context | load a different stylesheet | toggle a class, or let a user preference (e.g. dark mode) apply |
| Can contexts combine at runtime (dark *and* error at once)? | only if that exact combination was built | yes — combinations compose in the browser |

### Point-wise equivalence

The two models are reconciled by one standing correctness criterion: **for every
input, the runtime-composed output must equal the specification's flattened
resolution of that same input.** The specification's pipeline defines each
point; this repository's output represents the space; equivalence at every
point is what makes the representation faithful — and it is mechanically
verifiable against any conformant resolver.

```text
input { theme: dark }
  spec pipeline:  flatten dark.tokens.json over the base   →  --color-text: #fff
  this output:    light-dark(#000, #fff) under a dark OS    →  #fff   ✓ same point
```

## Quick Start

```bash
git clone https://github.com/canonical/design-tokens
cd design-tokens
bun install
bun run build              # Build all packages (tokens, plugin, LSP)
bun run build:all          # Build everything including the VS Code extension

# In a consuming project:
npm install -D @canonical/design-tokens
npx @canonical/terrazzo-lsp-extension
```

The VS Code extension is published as `@canonical/terrazzo-lsp-extension`.
It auto-detects `bun` first and falls back to `node >= 22`.

## Linking into a Consuming Project

During local development you can link the token package into a consuming monorepo using `bun link`. This avoids publishing to a registry while iterating on tokens.

### 1. Register the package

From the **tokens sub-package** (not the monorepo root):

```bash
cd packages/tokens
bun link
```

This registers `@canonical/design-tokens` globally for the current user.

### 2. Link in the consumer

From the **root** of the consuming monorepo (e.g. pragma):

```bash
cd /path/to/pragma
bun link @canonical/design-tokens
```

Run the command from the monorepo root so that Bun can resolve workspace dependencies (`workspace:*` specifiers) that would fail in an individual sub-package.

### 3. Configure the LSP artifact path

The LSP resolves bare specifiers (e.g. `@canonical/design-tokens/dist/tokens.json`) by joining the config file's directory with `node_modules/`. In a monorepo, `bun link` installs the symlink at the **root** `node_modules/`, not in each sub-package. If the `terrazzo-lsp.config.json` lives in a nested package, the bare specifier will not resolve because there is no local `node_modules/@canonical/design-tokens` at that level.

Use the package specifier directly:

```json
{
  "artifacts": ["@canonical/design-tokens/dist/tokens.json"]
}
```

## Prerequisites

**Required:**

- **Bun 1.3 or later** for package management, builds, and test execution.

  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

**Recommended:**

- **Node.js >= 22** as an alternative runtime for the LSP server (if Bun is not available in the target environment).

If neither runtime is available, the VS Code extension shows an actionable
error. If no `terrazzo-lsp.config.json` is found, the server logs the candidate
paths it tried, includes a copy-pasteable starter config, and exits unless
started with `--allow-degraded`.

## Repository Structure

```
design-tokens/
├── packages/
│   ├── tokens/                 @canonical/design-tokens
│   │   └── tokens/canonical/   Token definitions (DTCG format)
│   ├── plugin/                 @canonical/terrazzo-plugin-css
│   │   └── src/                Terrazzo CSS plugin
│   ├── lsp/                    @canonical/terrazzo-lsp
│   │   └── src/                Language server
│   ├── lsp-extension/          @canonical/terrazzo-lsp-extension
│   │   └── extension.ts        VS Code extension (bundles the LSP server)
│   └── types/                  @canonical/token-types
│       └── src/                Shared artifact types
├── documentation/              Explanatory guides
└── session/                    Design documents and analysis notes
```

## Packages

| Package | Description | README |
|---------|-------------|--------|
| [`@canonical/design-tokens`](packages/tokens/) | Token definitions (DTCG format) with CSS custom property output. | [packages/tokens/README.md](packages/tokens/README.md) |
| [`@canonical/terrazzo-plugin-css`](packages/plugin/) | Terrazzo CSS plugin — transforms DTCG tokens into CSS custom properties with `light-dark()`, modifier families, `@layer` ordering, and `@media` scoping. | [packages/plugin/README.md](packages/plugin/README.md) |
| [`@canonical/terrazzo-lsp`](packages/lsp/) | Language server providing CSS custom property intelligence — completions, hover, diagnostics, go-to-definition, rename, document colours, and workspace symbols. | [packages/lsp/README.md](packages/lsp/README.md) |
| [`@canonical/terrazzo-lsp-extension`](packages/lsp-extension/) | VS Code extension that bundles the LSP server. Install with `npx @canonical/terrazzo-lsp-extension`. | [packages/lsp-extension/README.md](packages/lsp-extension/README.md) |
| [`@canonical/token-types`](packages/types/) | Shared TypeScript types defining the `tokens.json` artifact contract between the plugin and the LSP. | [packages/types/README.md](packages/types/README.md) |

## Design Tokens

Token definitions live in `packages/tokens/tokens/canonical/` and are organised into two tiers that reflect their role in the design system. The separation enforces a clear contract: components reference semantic tokens, and semantic tokens alias primitives. This indirection allows the design system to evolve its raw values without requiring changes in consuming code.

### Token Tiers

| Tier | Path | Description |
|------|------|-------------|
| Primitive | `global/primitive/` | Raw values for colour, dimension, number, and typography. These are the source of truth and are not intended for direct use in application code. |
| Semantic | `global/semantic/` | Aliased tokens referencing primitives. These encode design intent (e.g. `color.background.default`) and are the tokens consumed by components. |

```jsonc
// primitive — the raw value, defined once
"palette": { "green": { "520": {
  "$value": { "colorSpace": "oklch", "components": [0.551, 0.1575, 144.01] } } } }

// semantic — design intent, aliasing the primitive
"foreground": { "primary": { "constructive": { "$root": {
  "$value": "{color.palette.green.520}" } } } }
```

The resolver configuration in `canonical.resolver.json` controls how tokens map to CSS custom properties during the build.

### Token Types

Tokens span several CSS value types. The LSP uses these types for diagnostics (catching type mismatches like assigning a colour token to `padding`) and for context-aware completion sorting.

| Type | DTCG Type | CSS Type | Examples |
|------|-----------|----------|----------|
| Colour | `color` | `<color>` | `--color-background-default`, `--color-text-muted` |
| Dimension | `dimension` | `<length>` | `--dimension-300`, `--dimension-1000` |
| Number | `number` | `<number>` | `--font-weight-bold`, `--opacity-disabled` |
| Font Family | `fontFamily` | `<custom-ident>+` | `--font-family-default` |

## Terrazzo LSP

A language server providing CSS custom property intelligence for design token workflows. It reads the `tokens.json` build artifact and provides editor features for CSS and SCSS files. See the [LSP README](packages/lsp/README.md) for the full feature reference, diagnostics guide, configuration schema, and editor setup instructions.

Quick editor setup for consumers:

```bash
npm install -D @canonical/design-tokens
npx @canonical/terrazzo-lsp-extension
```

Then create a `terrazzo-lsp.config.json` in your project root:

```json
{
  "artifacts": ["@canonical/design-tokens/dist/tokens.json"]
}
```

The LSP also works as a CLI tool for CI pipelines:

```bash
npx terrazzo-lsp check [globs]    # Run diagnostics on CSS files
npx terrazzo-lsp status           # Show config and artifact status
npx terrazzo-lsp inspect <var>    # Inspect a CSS custom property
```

## Documentation

| Document | Description |
|----------|-------------|
| [documentation/surfaces.md](documentation/surfaces.md) | Surface tokens — use cases, depth compounding, design rationale, and CSS cascade positioning. |

## Development

### Branch Rebasing

This repository uses a stacked PR workflow where feature branches build on each other. When a PR is merged to main, downstream branches need to be rebased to maintain a clean history.

**Rebase procedure:**

1. After merging a PR (e.g. pt2 → main), rebase the next branch on main:
   ```bash
   git checkout ft-token-build-pt3
   git rebase main
   ```

2. Skip already-merged commits when prompted:
   ```bash
   git rebase --skip  # For commits already in main
   ```

3. Resolve any conflicts:
   ```bash
   # For bun.lock conflicts, regenerate:
   bun run special:clean && rm bun.lock && bun i
   git add bun.lock && git rebase --continue

   # For other conflicts, take the appropriate version:
   git checkout --ours <file>    # Keep your changes
   git checkout --theirs <file>  # Take main's version
   git add <file> && git rebase --continue
   ```

4. Verify checks pass locally:
   ```bash
   npx lerna run check
   npx lerna run test
   ```

5. Force push the rebased branch:
   ```bash
   git push origin ft-token-build-pt3 --force-with-lease
   ```

6. Repeat for each downstream branch in order (pt3 → pt4 → pt5).

**Common issues:**

- **bun.lock conflicts:** Always regenerate with `bun run special:clean && rm bun.lock && bun i`
- **Duplicate commits:** Use `git rebase --skip` to skip commits already in main
- **CI not running:** Ensure the branch is pushed with `--force-with-lease` after rebasing

### Scripts

Root scripts delegate to all packages via Lerna with Nx caching:

| Script | Description |
|--------|-------------|
| `bun run build` | Build all packages (dependency-ordered) |
| `bun run build:all` | Build everything including the VS Code extension |
| `bun run check` | Run Biome linting + TypeScript type checking across all packages |
| `bun run check:fix` | Auto-fix Biome issues + type check |
| `bun run test` | Run all tests via Vitest |

Run scripts in a single package:

```bash
cd packages/lsp && bun run test
cd packages/plugin && bun run build
```

### Testing

Run the full test suite:

```bash
bun run test
```

Run only the LSP tests:

```bash
cd packages/lsp && bun run test
```

Run only the plugin tests:

```bash
cd packages/plugin && bun run test
```

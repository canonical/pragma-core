# @canonical/terrazzo-plugin-css

Terrazzo CSS plugin for Canonical design tokens. Transforms DTCG token definitions into CSS custom properties with `light-dark()` colour mode output, modifier families, `@layer` ordering, and `@media` scoping.

## Installation

```bash
bun add -d @canonical/terrazzo-plugin-css
```

## Usage

Add the plugin to your `terrazzo.config.ts`:

```ts
import { defineConfig } from "@terrazzo/cli";
import { canonicalPlugin } from "@canonical/terrazzo-plugin-css";

export default defineConfig({
  tokens: ["./tokens/canonical/canonical.resolver.json"],
  outDir: "./dist/",
  plugins: [canonicalPlugin()],
});
```

The plugin produces CSS files and a `tokens.json` artifact in the output directory. The `tokens.json` file is the bridge between the build system and the LSP — it contains every token's resolved value, type, tier, alias chain, and CSS output file location.

## Configuration

`canonicalPlugin()` accepts an options object:

```ts
canonicalPlugin({
  tokensDir: "./tokens/canonical",       // Base directory for token sources (default)
  families: [                            // Modifier family names
    "anticipation",
    "criticality",
    "emphasis",
    "importance",
  ],
  layers: { /* @layer name overrides */ },
  sets: {                                // Primitive / semantic set configuration
    primitive: { /* ... */ },
    semantic:  { /* ... */ },
  },
  theme:      { /* light/dark theme config */ },
  typography: { /* typography modifier config */ },
  surfaces:   { /* surface selector mapping */ },
  states:     { /* interactive state derivation */ },
  motion:     { /* prefers-reduced-motion scoping */ },
  contrast:   { /* prefers-contrast scoping */ },
});
```

| Option | Description |
|--------|-------------|
| `tokensDir` | Base directory for token source files. Used to locate modifier sources and read DTCG alias targets. Default: `"./tokens/canonical"`. |
| `families` | Modifier family names to generate (e.g. `"criticality"`, `"emphasis"`). Default: `["anticipation", "criticality", "emphasis", "importance"]`. |
| `layers` | CSS `@layer` name overrides for controlling specificity ordering. |
| `sets` | Configuration for primitive and semantic token sets. |
| `theme` | Light/dark theme modifier — controls `light-dark()` output and `color-scheme` declarations. |
| `typography` | Typography modifier configuration. |
| `surfaces` | Maps resolver context names to CSS selectors. See [documentation/surfaces.md](../../documentation/surfaces.md). |
| `states` | Interactive state derivation layer (hover, active, disabled). |
| `motion` | `@media (prefers-reduced-motion)` scoping configuration. |
| `contrast` | `@media (prefers-contrast)` scoping configuration. |

## Development

```bash
bun run build     # Compile plugin (tsc)
bun run test      # Run tests
bun run check     # Lint + type check
```

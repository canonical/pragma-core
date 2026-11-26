# Packaging Standards

Standards for packaging development.

## Applications organize by domain

**Identifier:** `cs:packaging.application.structure`

Application packages (CLIs, servers, MCP tools, build scripts, workers) execute behavior through entry points. They are not imported as dependencies by other packages. Their internal code must be organized around execution domains (commands, routes, tools, operations) rather than library conventions like `src/lib/` or barrel re-exports. Each domain folder must have its own barrel file (`index.ts`) that defines the domain's internal API — sibling domains import through the barrel, never from individual files.

### Do

Recognise an application package by its `package.json` signals — `bin` field, `private: true`, no `main`/`exports`
```json
{
  "name": "@scope/my-cli",
  "private": true,
  "bin": { "my-cli": "./dist/index.js" }
}
```

Organize code around execution domains. Each domain folder gets its own barrel (`index.ts`) that exposes the domain's internal API to sibling domains
```
packages/my-cli/
├── src/
│   ├── commands/              # CLI command handlers
│   │   ├── build.ts
│   │   ├── build.test.ts
│   │   ├── deploy.ts
│   │   ├── deploy.test.ts
│   │   └── index.ts           # Barrel: exports all commands
│   ├── operations/            # Shared internal logic across commands
│   │   ├── resolveConfig.ts
│   │   ├── resolveConfig.test.ts
│   │   ├── runValidation.ts
│   │   ├── runValidation.test.ts
│   │   └── index.ts           # Barrel: exports shared operations
│   ├── utils/                 # Internal helpers
│   │   ├── formatOutput.ts
│   │   ├── formatOutput.test.ts
│   │   └── index.ts           # Barrel: exports utilities
│   └── index.ts               # Entry point (bootstraps CLI)
└── package.json
```

Import from sibling domains through their barrel, not from individual files
```typescript
// src/commands/deploy.ts
import { resolveConfig, runValidation } from "../operations/index.js";
import { formatOutput } from "../utils/index.js";
```

Use domain-appropriate folder names that reflect what the code does — `commands/`, `tools/`, `routes/`, `operations/`, `handlers/`
```
packages/my-mcp/
├── src/
│   ├── tools/                 # MCP tool handlers
│   │   ├── query.ts
│   │   ├── query.test.ts
│   │   ├── mutate.ts
│   │   ├── mutate.test.ts
│   │   └── index.ts           # Barrel: exports tool handlers
│   ├── operations/            # Shared internal logic
│   │   ├── executeQuery.ts
│   │   ├── executeQuery.test.ts
│   │   └── index.ts           # Barrel: exports shared operations
│   └── index.ts               # MCP server entry point
└── package.json
```

For **hybrid** packages (primarily application but exporting a small reusable surface), isolate the exported surface in `src/lib/` following library rules while keeping the rest as application structure
```
packages/my-mcp/
├── src/
│   ├── lib/                   # Only the reusable exported surface
│   │   ├── types.ts
│   │   └── index.ts           # Barrel: public API for external consumers
│   ├── tools/                 # MCP tool handlers (not exported)
│   │   ├── query.ts
│   │   ├── query.test.ts
│   │   ├── mutate.ts
│   │   ├── mutate.test.ts
│   │   └── index.ts           # Barrel: exports tool handlers
│   ├── operations/            # Shared internal logic
│   │   ├── executeQuery.ts
│   │   ├── executeQuery.test.ts
│   │   └── index.ts           # Barrel: exports shared operations
│   └── index.ts               # MCP server entry point
└── package.json
```

### Don't

Apply library structure (`src/lib/`, barrel re-exports) to application packages
```
// Bad: CLI tool forced into library layout
packages/my-cli/
├── src/
│   ├── lib/               # Wrong: this is a CLI, not a library
│   │   ├── commands/
│   │   └── index.ts       # Barrel re-export — nobody imports this
│   └── index.ts
```

Create a `src/lib/` folder for internal shared operations. Use domain-appropriate names instead
```
// Bad: "lib" implies external consumption
packages/my-cli/
├── src/
│   ├── lib/
│   │   └── resolveConfig.ts   # Only used internally

// Good: "operations" or "shared" makes intent clear
packages/my-cli/
├── src/
│   ├── operations/
│   │   └── resolveConfig.ts   # Internal shared logic
```

Import directly from files inside a sibling domain — always go through the domain barrel
```typescript
// Bad: reaching into a sibling domain's internals
import resolveConfig from "../operations/resolveConfig.js";
import formatOutput from "../utils/formatOutput.js";

// Good: import through the domain barrel
import { resolveConfig } from "../operations/index.js";
import { formatOutput } from "../utils/index.js";
```

Omit barrels from domain folders
```
// Bad: no barrels — every consumer imports individual files
packages/my-cli/
├── src/
│   ├── commands/
│   │   ├── build.ts
│   │   └── deploy.ts       # No index.ts — siblings must know file names
│   ├── operations/
│   │   ├── resolveConfig.ts
│   │   └── runValidation.ts # No index.ts — fragile cross-domain imports
```

Default to library structure just because the package lives in a monorepo
```
// Bad: reflexively adding lib/ to a build script package
packages/build-tools/
├── src/
│   ├── lib/               # This is a build script, not a library
│   │   └── runBuild.ts
│   └── index.ts
```

---

## Barrels define the API surface

**Identifier:** `cs:packaging.export.barrel`

Every domain folder must have a barrel file (`index.ts`) that defines its API surface. In library packages, barrels define the public API for external consumers. In application packages, barrels define the internal API between sibling domains. Within a domain, implementation files import from siblings directly; cross-domain imports always go through the barrel.

### Do

Use a barrel at the package entry point to define the public API (library packages)
```typescript
// src/index.ts
export { Button, type ButtonProps } from "./lib/index.js";
```

Use a barrel at each domain folder to define the domain's API (application packages)
```typescript
// src/operations/index.ts
export { default as resolveConfig } from "./resolveConfig.js";
export { default as runValidation } from "./runValidation.js";
```

Import internal implementation code within a domain from the owning file directly
```typescript
// src/build/buildTheme.ts — same domain, import the file
import computeDeltas from "./computeDeltas.js";
import recoverPrimitiveRef from "./recoverPrimitiveRef.js";
```

Import cross-domain code through the sibling domain's barrel
```typescript
// src/commands/deploy.ts — different domain, import through barrel
import { resolveConfig } from "../operations/index.js";
```

Keep compatibility barrels thin and documented as public facades
```typescript
/** Public compatibility surface. */
export { default as computeDeltas } from "./computeDeltas.js";
export { default as formatDelta } from "./formatDelta.js";
```

### Don't

Route internal same-domain code through its own barrel
```typescript
// Bad: internal implementation depends on its own barrel
// src/build/applyTheme.ts
import { computeDeltas, recoverPrimitiveRef } from "./index.js";
```

Import cross-domain code by reaching into individual files
```typescript
// Bad: bypassing the domain barrel
import resolveConfig from "../operations/resolveConfig.js";

// Good: through the barrel
import { resolveConfig } from "../operations/index.js";
```

Hide domain ownership behind convenience barrels
```typescript
// Bad: types appear to belong to context.ts instead of their owning domains
import type { Artifact, CSSNode, OverlayToken } from "./context.js";
```

Omit the barrel from a domain folder
```
// Bad: no index.ts — consumers must know internal file names
src/operations/
├── resolveConfig.ts
└── runValidation.ts
```

---

## Export at the declaration

**Identifier:** `cs:packaging.export.declaration`

Declare each export on its definition. Except: a story's `meta`, a tool config, a context, or a wrapped or cast component or function may be a `const` exported as the default on a separate line; a Svelte module lists its snippets.

### Do

Export on the definition, or bind a wrapped or cast value first
```tsx
// formatCurrency.ts
export default function formatCurrency(value: number): string { /* ... */ }

// CardItem.tsx
const CardItem = <T,>({ item }: CardItemProps<T>) => <li>{item.name}</li>;
export default memo(CardItem) as typeof CardItem;
```

### Don't

Export away from the definition, or wrap a `function` declaration
```tsx
// formatCurrency.ts
const formatCurrency = (value: number) => { /* ... */ };
export default formatCurrency;

// CardItem.tsx
function CardItem({ item }: CardItemProps) { /* ... */ }
export default memo(CardItem);
```

---

## Default or uniform named exports

**Identifier:** `cs:packaging.export.shape`

A file exports one thing, as its default export, named exactly as the file: `formatName.ts` → `export default function formatName`. Except, these use named exports only, never a default: `types.ts` (only types); `constants.ts` (only plain values); a family file of functions with one signature, named after the family (`formatters.ts`: `formatName`, `formatNumber`, both `(value) => string`) — a type, hook or component never joins a family; barrels (`index.ts`), stories, fixtures and files a tool loads.

### Do

Export one default named as the file, or a family of one signature by name
```typescript
// formatName.ts
export default function formatName(value: User): string { /* ... */ }

// formatters.ts: each is (value) => string
export const formatName = (value: User): string => { /* ... */ };
export const formatNumber = (value: number): string => { /* ... */ };
```

### Don't

Export a type, a hook and a default from one file
```tsx
// MenuContext.tsx
export interface MenuContextValue { open: boolean }

const MenuContext = createContext<MenuContextValue | null>(null);
export const useMenuContext = () => useContext(MenuContext);
export default MenuContext;
```

---

## Subpath imports for applications only

**Identifier:** `cs:packaging.import.cross_domain`

How intra-package cross-domain imports are written depends on the package archetype: **applications may use `#` subpath imports; distributable packages must not.**

Application packages (not published — a build system such as Vite resolves and inlines module specifiers at build time, so no `#` alias survives into any shipped artifact) use Node.js subpath imports (the `imports` field in `package.json`) with the `#` prefix convention. Each `#` alias points directly to the domain's barrel file — no wildcard splats, no path suffixes, no extension mapping. Subpath imports are the official Node.js mechanism, work natively with Node, Bun, vitest, and tsc, and require no plugins. TypeScript resolves them when `resolvePackageJsonImports` is enabled (on by default with `moduleResolution` set to `node16`, `nodenext`, or `bundler`).

Distributable packages (published and consumed as dependencies) must not use `#` subpath imports. A published package must remain consumable when built with plain `tsc` — `tsc`-only builds are the north star for distributable packages — and `tsc` never rewrites module specifiers: a `#` alias in source is emitted verbatim into `dist`, leaking the package's private `imports` map into its public contract and forcing resolve configuration onto every consumer. Mismatched resolve conditions then break downstream builds — e.g. Vite/Vitest activating the `development` condition, which points at unpublished `src`. Distributable packages use ordinary relative imports with `.js` extensions (NodeNext) instead, still through the sibling domain's barrel.

In both archetypes the alternatives stay off the table: with `moduleResolution: "nodenext"` (or `"node16"`), bare specifiers like `error/index.js` are treated as package names, not path-relative imports, and the `paths` compiler option is a manual alias table — brittle and verbose.

### Do

In an application package, map each `#` alias directly to the domain barrel in `package.json` — no wildcards, no path suffixes
```json
{
  "imports": {
    "#config": "./src/config/index.ts",
    "#error": "./src/error/index.ts",
    "#pipeline": "./src/pipeline/index.ts",
    "#package-manager": "./src/package-manager/index.ts",
    "#constants": "./src/constants.ts"
  }
}
```

In an application package, import cross-domain modules using the `#` alias — clean, no path suffixes
```typescript
// src/pipeline/runPipeline.ts
import { PragmaError } from "#error";
import { resolveConfig } from "#config";
```

In a distributable package, import cross-domain modules with ordinary relative paths and `.js` extensions (NodeNext), still through the sibling domain's barrel
```typescript
// src/pipeline/runPipeline.ts — published package: no # aliases
import { PragmaError } from "../error/index.js";
import { resolveConfig } from "../config/index.js";
```

Use `moduleResolution: "nodenext"` (or `"node16"` / `"bundler"`) in `tsconfig.json` so TypeScript resolves subpath imports via `resolvePackageJsonImports` (enabled by default with these settings)
```json
{
  "compilerOptions": {
    "moduleResolution": "nodenext"
  }
}
```

In an application package, use conditional subpath imports when you need different resolutions for different environments
```json
{
  "imports": {
    "#db": {
      "development": "./src/db/mock.ts",
      "default": "./src/db/real.ts"
    }
  }
}
```

### Don't

Use `#` subpath imports in a distributable package — `tsc` never rewrites module specifiers, so the alias is emitted verbatim into `dist`, leaking the private `imports` map into the package's public contract
```typescript
// Bad: src/pipeline/runPipeline.ts in a *published* package
import { PragmaError } from "#error";

// tsc emits "#error" verbatim into dist/. Every consumer must now resolve
// the private alias itself, and a bundler/test-runner that activates the
// "development" condition (e.g. Vite/Vitest) resolves it to unpublished
// src/ and the downstream build breaks.
```

Use wildcard splats or path suffixes in `#` aliases — point directly to the barrel instead
```json
// Bad: wildcard mapping forces consumers to know internal file structure
{
  "imports": {
    "#config/*": "./src/config/*",
    "#error/*": "./src/error/*"
  }
}

// Bad: path suffix leaks barrel structure into every import site
import { PragmaError } from "#error/index.js";
```

Use bare specifiers without the `#` prefix for intra-package imports — they resolve as package names under `nodenext`
```typescript
// Bad: "error/index.js" resolves as the npm package "error", not ./src/error/
import { PragmaError } from "error/index.js";
```

Use `paths` in `tsconfig.json` as a substitute for subpath imports — it's a manual alias table that doesn't participate in Node.js resolution
```json
// Bad: brittle, verbose, requires a bundler or ts-patch to work at runtime
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@error/*": ["src/error/*"],
      "@config/*": ["src/config/*"],
      "@pipeline/*": ["src/pipeline/*"]
    }
  }
}
```

Reach across domains into individual files — cross-domain imports go through the domain's barrel: behind the `#` alias in an application, via a relative path to the barrel in a distributable package
```typescript
// Bad: bypasses the barrel, couples to internal file structure
import PragmaError from "../../error/PragmaError.js";

// Good (application): the alias points at the barrel
import { PragmaError } from "#error";

// Good (distributable package): relative path to the barrel
import { PragmaError } from "../error/index.js";
```

Import specific files through the `#` alias — go through the barrel instead
```typescript
// Bad: bypasses the barrel, couples to internal file structure
import readConfig from "#config/readConfig.js";

// Good: import through the barrel
import { readConfig } from "#config";
```

---

## Libraries export from src/lib

**Identifier:** `cs:packaging.library.structure`

A library keeps its exported code in `src/lib/`, with a barrel in each domain folder, re-exported through the root barrel. Except: an `@experimental` `./testing` subpath.

### Do

Keep exported code in `src/lib/`, behind barrels
```
src/lib/hooks/index.ts  # domain barrel
src/lib/index.ts        # lib barrel
src/index.ts            # root barrel
```

### Don't

Export code from outside `src/lib/`, or leave a domain folder without a barrel
```
src/components/Button.tsx   # Bad: exported from outside src/lib/
src/lib/hooks/useToggle.ts  # Bad: hooks/ has no barrel
```

---

## Manifests declare the runtime floor

**Identifier:** `cs:packaging.manifest.engines`

A published package must declare `engines.node` covering the highest runtime floor its own dependencies impose, and move that declaration in the same change that raises the floor.

### Do

Declare `engines.node` covering the highest floor among the package's runtime dependencies — here `commander@15` requires Node >=22.12
```json
{
  "name": "@scope/my-cli",
  "dependencies": {
    "commander": "^15.0.0"
  },
  "engines": {
    "node": ">=22.18 <23 || >=23.6"
  }
}
```

Raise the floor in the same change that raises the dependency, so the manifest and the dependency tree never disagree
```json
{
  "dependencies": {
    "commander": "^15.0.0"
  },
  "engines": {
    "node": ">=22.18 <23 || >=23.6"
  }
}
```

Use one range across sibling packages in a monorepo, so a consumer installing several of them cannot be handed conflicting floors
```bash
# Every publishable package resolves to the same declared floor
$ grep -h '"node"' packages/*/package.json | sort -u
    "node": ">=22.18 <23 || >=23.6"
```

### Don't

Depend on a package with a runtime floor while declaring no `engines` at all — the install is silent and the failure lands at runtime
```json
{
  "name": "@scope/my-cli",
  "dependencies": {
    "commander": "^15.0.0"
  }
}
```

Declare a floor lower than a dependency requires — the manifest states support the package cannot deliver
```json
{
  "dependencies": {
    "commander": "^15.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Treat the declaration as settled once written. A dependency can raise its own floor in a version your range already accepts, so a floor that was correct when measured goes stale with no change to your manifest.
```json
{
  "dependencies": {
    // Written when 15.0.0 required Node >=22.12. If 15.1.0 raises that to
    // >=24, this range accepts it and the declared floor below becomes a
    // claim the package can no longer honour — with nothing in the diff to
    // show it. Verify the floor rather than assuming it holds.
    "commander": "^15.0.0"
  },
  "engines": {
    "node": ">=22.18 <23 || >=23.6"
  }
}
```

Rely on the dependency's own `engines` to warn the consumer — package managers report the transitive package, naming a dependency the consumer never chose
```bash
# The warning names commander, not the package that pulled it in
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'commander@15.0.0',
npm warn EBADENGINE   required: { node: '>=22.12.0' },
npm warn EBADENGINE   current: { node: 'v20.19.0' }
npm warn EBADENGINE }
```

---

## Filename matches the export

**Identifier:** `cs:packaging.naming.single_export_file`

A file is named after its export, in its casing: `isAccepted.ts`, `EventEmitter.ts`. Except: `index.ts`, `types.ts`, `constants.ts`, `testing/fixtures.ts` and the files a tool loads keep their names; a family file is named after its family.

### Do

Name the file after its export, or after its family
```typescript
// isAccepted.ts
export default function isAccepted(status: string): boolean { /* ... */ }

// EventEmitter.ts
export default class EventEmitter { /* ... */ }

// formatters.ts
export const formatName = (value: User): string => { /* ... */ };
```

### Don't

Name the file generically, by its domain, or in another casing
```typescript
// helpers.ts: should be isAccepted.ts
export default function isAccepted(status: string): boolean { /* ... */ }

// network.ts: should be ConnectionConfig.ts
export default class ConnectionConfig { /* ... */ }

// eventEmitter.ts: should be EventEmitter.ts
export default class EventEmitter { /* ... */ }
```

---

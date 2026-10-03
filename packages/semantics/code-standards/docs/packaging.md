# Packaging Standards

Standards for packaging development.

## Domain-Owned Block Kit

**Identifier:** `cs:packaging.application.domain_blocks`

In an application (or hybrid) package that renders UI, the shared/global tier (`src/lib/`) and every bounded-context domain (`src/domains/<name>/`) each own a `blocks/` folder with an IDENTICAL shape — sub-folders named by the design-system's block kinds (`component/`, `pattern/`, `layout/`, `group/`; a `page/` kind where the design system authors one). A single, kind-split block taxonomy that is byte-for-byte the same at the global tier and the app-domain tier makes file placement deterministic and cross-tier navigation predictable: a reader who knows `lib/blocks/` already knows `domains/<x>/blocks/`. This lifts the design-system's `ds:UIBlock` tier+kind model into a concrete folder law. The global-vs-domain-local axis is decided by REUSE — reused across two or more domains lands in the `lib/` tier; owned by one bounded context lands in that domain. A subcomponent is NOT a peer kind-folder: it nests inside its parent block's folder under `common/<Sub>/` per cs:react.component.dependencies. The specific kind NAMES are supplied by the design system, not by this standard; where a design system authors a different set of block kinds, mirror THAT set identically in both tiers.

### Do

Give the global `lib/` tier and every domain the SAME `blocks/{kind}` split, kinds supplied by the design system (`component/ pattern/ layout/ group/`).
```
packages/my-app/src/
├── lib/
│   └── blocks/               # GLOBAL tier — reused across ≥2 domains
│       ├── component/        # GlyphCell, Row, BaseChip, Legend
│       ├── pattern/          # Fold, RowList, OverlayCard
│       ├── layout/           # Frame, PaneSplit, Aside
│       └── group/
└── domains/
    └── room/
        └── blocks/           # DOMAIN tier — IDENTICAL shape
            ├── component/     # domain-local blocks only
            ├── pattern/
            ├── layout/        # RoomLayout, ChatLayout
            └── group/
```

Nest a subcomponent inside its parent block's `common/<Sub>/`, not in a flat `blocks/subcomponent/`. Cite cs:react.component.dependencies; dependencies stay unidirectional (parent → sub, never sub → parent).
```
blocks/pattern/RowList/
├── RowList.tsx
├── common/
│   └── Seat/
│       ├── Seat.tsx
│       ├── Seat.test.tsx
│       └── index.ts
├── types.ts
└── index.ts
```

Decide the tier by reuse — a block used by two or more domains is global (`lib/blocks/`); a block owned by one bounded context is domain-local (`domains/<name>/blocks/`).
```typescript
// Reused by timeline, asks, and room → global tier
// lib/blocks/pattern/RowList/RowList.tsx

// Owned only by the room bounded context → domain tier
// domains/room/blocks/layout/ChatLayout/ChatLayout.tsx
```

### Don't

Give a domain a different block layout from the global tier, so placement stops being predictable across tiers.
```
// Bad: global tier is kind-split but the domain invents its own scheme
lib/blocks/{component,pattern,layout,group}/    # kind-split
domains/room/ui/{chat,roster,composer}/         # ad-hoc, non-mirroring
```

Promote a subcomponent to a fifth peer kind-folder — it is a part-of-parent, not a standalone kind.
```
// Bad: a flat subcomponent kind-folder breaks part-of-parent locality
blocks/subcomponent/Seat/Seat.tsx

// Good: the sub nests inside its one parent
blocks/pattern/RowList/common/Seat/Seat.tsx
```

---

## Route Content — Layout vs Page

**Identifier:** `cs:packaging.application.route_content`

The content a route mounts is either a Layout (pure arrangement of space — no situated meaning, no data or effect) or a Page (a Layout situated with semantic context or backed by a hook). Default to a bare Layout; PROMOTE to a Page if and only if EITHER (a) the situation carries semantic meaning beyond arrangement, OR (b) the content needs a hook (data read, effect, or lifecycle). Route content that calls a hook must be a Page, never a raw Layout. Separating pure arrangement (Layout) from situated/behavioral content (Page) keeps layouts trivially reusable and testable with no data dependency, and concentrates reads and effects at the Page tier where the route boundary already sits. The promote-iff rule is a mechanical test a fence can enforce, so route content cannot silently smuggle a hook into a 'layout'. Pages live under `blocks/page/` (domain-local) or the `lib/` page kit (reusable), pairing with the design-system's `ds:Page` block kind and with cs:packaging.application.domain_blocks. This standard is independent of any particular query/prefetch HoC, which is an implementation detail.

### Do

Keep a route's content a bare Layout when it is pure arrangement — no hook, no situated meaning. It stays trivially reusable and data-free.
```typescript
// blocks/layout/RoomLayout/RoomLayout.tsx — pure arrangement, no hook
export const RoomLayout = ({ roster, thread, composer }: RoomLayoutProps) => (
  <PaneSplit>
    <Aside>{roster}</Aside>
    <Frame>{thread}{composer}</Frame>
  </PaneSplit>
);
```

Promote to a Page (under `blocks/page/`) exactly when the content needs a hook or carries semantic context — the Page reads, the Layout arranges.
```typescript
// blocks/page/RoomPage/RoomPage.tsx — needs a read hook → a Page
export const RoomPage = () => {
  const room = useRoomRecord();          // a hook → must be a Page
  return <RoomLayout roster={room.roster} thread={room.thread} composer={<Composer />} />;
};
```

### Don't

Call a hook inside a file named/placed as a Layout — hook-bearing route content must be a Page.
```typescript
// Bad: a 'Layout' that secretly reads — it is a Page in disguise
export const RoomLayout = () => {
  const room = useRoomRecord();          // hook → this is NOT a Layout
  return <PaneSplit>…</PaneSplit>;
};
```

---

## Domain Spine vs Blocks

**Identifier:** `cs:packaging.application.spine_vs_blocks`

Within an application domain, ONLY files that render UI (return JSX / framework nodes) may live under `blocks/`. The non-rendering SPINE — data reads, the routing seam, projection folds, registry/citizenship wiring, types, constants, and the barrel — stays FLAT at the domain root, with `routes.ts` (or the equivalent) as the domain's single public seam that sibling domains import through. Splitting a domain along the render boundary keeps the rendered surface swappable and the data/wiring core testable in isolation, and makes 'where does this file go?' answerable by one question: does it render? A rendering file sitting at the flat spine, or a pure data/wiring file placed under `blocks/`, is a structural defect. The public seam concentrates the cross-domain contract in one importable file so refactors inside a domain never ripple to siblings. The specific spine members (read/fold/projections/citizenship) are examples of the data-and-wiring core, not an exhaustive list — the law is the render/no-render partition plus one public seam per domain.

### Do

Keep the non-rendering spine flat at the domain root; pull ONLY rendered UI out into `blocks/`. `routes.ts` is the single public seam.
```
domains/room/
├── read.ts          # fragment reader / store read      — spine
├── routes.ts        # the PUBLIC SEAM siblings import    — spine
├── fold.ts          # projection fold                    — spine
├── projections.ts   # derived projections               — spine
├── citizenship.ts   # registry citizenship               — spine
├── types.ts         #                                    — spine
├── constants.ts     #                                    — spine
├── index.ts         #                                    — spine
└── blocks/          # ← only rendered UI lives here
    └── layout/RoomLayout/RoomLayout.tsx
```

Import a sibling domain through its single public seam (`routes.ts`), never into its internals.
```typescript
// sibling domain imports the room contract through its one seam
import { roomRoutes } from "../room/routes.js";
```

### Don't

Leave a rendering file (returns JSX) sitting at the flat spine instead of under `blocks/`.
```typescript
// Bad: RoomView renders but sits at the flat spine
domains/room/RoomView.tsx        // returns JSX → belongs in blocks/

// Good: rendered UI moves under blocks/
domains/room/blocks/layout/RoomLayout/RoomLayout.tsx
```

Bury a pure data / wiring file (no render) under `blocks/` — the spine must stay flat and discoverable.
```
// Bad: a non-rendering fold hidden inside blocks/
domains/room/blocks/pattern/fold.ts

// Good: non-rendering spine stays flat
domains/room/fold.ts
```

---

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
│   │   ├── deploy.ts
│   │   └── index.ts           # Barrel: exports all commands
│   ├── operations/            # Shared internal logic across commands
│   │   ├── resolveConfig.ts
│   │   ├── runValidation.ts
│   │   └── index.ts           # Barrel: exports shared operations
│   ├── utils/                 # Internal helpers
│   │   ├── formatOutput.ts
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
│   │   ├── mutate.ts
│   │   └── index.ts           # Barrel: exports tool handlers
│   ├── operations/            # Shared internal logic
│   │   ├── executeQuery.ts
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
│   │   ├── mutate.ts
│   │   └── index.ts           # Barrel: exports tool handlers
│   ├── operations/            # Shared internal logic
│   │   ├── executeQuery.ts
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
import { resolveConfig } from "../operations/resolveConfig.js";
import { formatOutput } from "../utils/formatOutput.js";

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
export { Button } from "./components/Button.js";
export type { ButtonProps } from "./components/Button.types.js";
```

Use a barrel at each domain folder to define the domain's API (application packages)
```typescript
// src/operations/index.ts
export { resolveConfig } from "./resolveConfig.js";
export { runValidation } from "./runValidation.js";
```

Import internal implementation code within a domain from the owning file directly
```typescript
// src/build/buildTheme.ts — same domain, import the file
import { computeDeltas } from "./computeDeltas.js";
import { recoverPrimitiveRef } from "./recoverPrimitiveRef.js";
```

Import cross-domain code through the sibling domain's barrel
```typescript
// src/commands/deploy.ts — different domain, import through barrel
import { resolveConfig } from "../operations/index.js";
```

Keep compatibility barrels thin and documented as public facades
```typescript
/** Public compatibility surface. */
export { computeDeltas } from "./computeDeltas.js";
export { formatDelta } from "./formatDelta.js";
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
import { resolveConfig } from "../operations/resolveConfig.js";

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

Exports must be declared on the definition itself (e.g. `export default function` or `export const`), not gathered at the end of the file. When a wrapper (HOC, decorator, middleware) is applied, declare the unwrapped binding with `const`, then export the wrapped result as default on a separate line.

### Do

Declare the export directly on the function or class definition
```typescript
// formatCurrency.ts
export default function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}
```

Declare the export directly on a named constant
```typescript
// MAX_RETRIES.ts
export const MAX_RETRIES = 3;
```

When a wrapper is involved, declare the raw binding with `const`, then export the wrapped result as default
```typescript
// UserProfile.tsx
const UserProfile = ({ user }: UserProfileProps) => {
  return <div>{user.name}</div>;
};

export default memo(UserProfile);
```

Apply the same pattern for higher-order functions and middleware
```typescript
// connectDatabase.ts
const connectDatabase = (config: DbConfig): Connection => {
  return new Connection(config);
};

export default withRetry(connectDatabase);
```

### Don't

Define a symbol and then export it at the end of the file
```typescript
// Bad: export is separated from definition
function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default formatCurrency;
```

Gather multiple exports at the bottom of the file
```typescript
// Bad: exports collected at the end
const helperA = () => {};
const helperB = () => {};

export { helperA, helperB };
```

Use `export default` on the raw binding when a wrapper is needed
```typescript
// Bad: exports the unwrapped version, then wraps elsewhere
export default function UserProfile({ user }: UserProfileProps) {
  return <div>{user.name}</div>;
}

// consumer.ts — has to wrap it themselves
import UserProfile from "./UserProfile.js";
const Memoized = memo(UserProfile);
```

---

## Default or uniform named exports

**Identifier:** `cs:packaging.export.shape`

Files must use either a single default export or multiple named exports. When using multiple named exports, all exports must have the same type or shape.

### Do

Use a single default export for files implementing a single component or function
```typescript
// ComponentName.tsx
export default ComponentName;
```

Name atomic function files after the function they export
```typescript
// assignElement.ts
export default function assignElement(target: Element, source: Partial<Element>) {
  // ...
}

// formatCurrency.ts
export default function formatCurrency(value: number) {
  // ...
}
```

Use multiple named exports for files providing a public API or a collection of related items, and ensure all exports have the same type
```typescript
// index.ts
export { ComponentA, ComponentB };

// types.ts
export type TypeA = { ... };
export type TypeB = { ... };

// Consistent export shape:
export const myFuncA = (value: string) => {};
export const myFuncB = (value: string) => {};
export const myFuncC = (value: string) => {};
```

### Don't

Mix default and unrelated named exports in a way that confuses the file's purpose
```typescript
export default ComponentName;
export const helper = () => {};
```

Name an atomic function file with a name that doesn't match its exported function
```typescript
// helpers.ts — wrong: generic name instead of function name
export default function assignElement(target: Element, source: Partial<Element>) {
  // ...
}

// utils.ts — wrong: generic name instead of function name
export default function formatCurrency(value: number) {
  // ...
}
```

Provide multiple unrelated exports from a file meant for a single domain
```typescript
export default debounce;
export const throttle = () => {};
export const logger = () => {};
```

Export objects of different types or shapes from the same file
```typescript
export const transformer = (value: string) => {};
export const reducer = (map: string[]) => {};
class ABC {}
export { ABC };
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
import { PragmaError } from "../../error/PragmaError.js";

// Good (application): the alias points at the barrel
import { PragmaError } from "#error";

// Good (distributable package): relative path to the barrel
import { PragmaError } from "../error/index.js";
```

Import specific files through the `#` alias — go through the barrel instead
```typescript
// Bad: bypasses the barrel, couples to internal file structure
import { readConfig } from "#config/readConfig.js";

// Good: import through the barrel
import { readConfig } from "#config";
```

---

## Concern-Grouped Library Surface

**Identifier:** `cs:packaging.library.concern_grouping`

When a package's shared `lib/` surface grows past a flat pile of peer subsystems, group its second level by CONCERN — each group barrel-sealed, with the `lib/index.ts` tier barrel re-exporting ONLY the curated group sub-barrels (`export *` over sub-barrels, never over a raw directory of internals). Placement is by a member's DEFINING trait. A flat `lib/` of a dozen peer folders hides the KINDS of code it contains; a concern grouping makes the shape legible and moves the barrel-seam guarantee one level deeper (`lib/<group>/<domain>/index.ts`) so the no-deep-import rule still holds. This is an amendment to apply ONLY when the flat surface is genuinely large — small libraries stay flat per cs:packaging.library.structure. The concern names are chosen per package to fit what it contains; one worked example set is `ui` (things that render), `runtime` (engine/store machinery), and `support` (cross-cutting home-less helpers) — these are ILLUSTRATIVE, not mandated names. The canonical rule is 'group a large shared surface by concern, keep each barrel-sealed, and let the tier barrel re-export only curated sub-barrels'.

### Do

Group a large `lib/` by concern; barrel-seal each group; let `lib/index.ts` re-export only the curated group sub-barrels. (Concern names are per-package; `ui`/`runtime`/`support` shown as one example set.)
```
lib/
├── ui/                    # concern: everything that RENDERS
│   ├── blocks/
│   ├── shell/
│   └── index.ts           # group barrel
├── runtime/               # concern: engine + store machinery
│   ├── grammar/
│   ├── state/
│   ├── relay/
│   └── index.ts           # group barrel
├── support/               # concern: cross-cutting home-less helpers
│   ├── encodings/
│   ├── pointer/
│   ├── utils/
│   └── index.ts           # group barrel
└── index.ts               # tier barrel: export * over the 3 group sub-barrels
```

Place a member by its DEFINING trait — a thing that renders the shell → `ui`; pure reference-data tables → `support`; the store/engine → `runtime`.
```typescript
// lib/index.ts — tier barrel over CURATED group sub-barrels only
export * from "./ui/index.js";
export * from "./runtime/index.js";
export * from "./support/index.js";
```

### Don't

`export *` over a raw directory of internals — the tier barrel re-exports only curated sub-barrels.
```typescript
// Bad: tier barrel spraying a raw folder's internals
export * from "./runtime/state/PathStore.js";
export * from "./runtime/state/reducer.js";

// Good: re-export the curated group sub-barrel
export * from "./runtime/index.js";
```

Impose the concern grouping on a small, still-legible flat `lib/` — group only once the flat surface stops scaling.
```
// Bad: three files ceremonially split into ui/runtime/support
lib/ui/Button/… · lib/runtime/store.ts · lib/support/clamp.ts

// Good: a small lib stays flat per cs:packaging.library.structure
lib/Button/… · lib/store.ts · lib/clamp.ts
```

---

## Libraries export from src/lib

**Identifier:** `cs:packaging.library.structure`

Library packages export reusable code (components, utilities, hooks, types) for consumption by other packages. They must organize their exportable code in a `src/lib/` folder and re-export through a root barrel. This convention ensures consistency across the monorepo and clearly separates public API code from non-exported concerns like storybook configuration or test utilities. Each domain folder within `lib/` must have its own barrel (`index.ts`).

### Do

Recognise a library package by its `package.json` signals — `main`/`exports` field, publishable, no `bin`
```json
{
  "name": "@scope/design-system",
  "main": "./dist/index.js",
  "exports": { ".": "./dist/index.js" }
}
```

Place all reusable/exportable code in `src/lib/`, with a barrel in each domain folder
```
packages/my-package/
├── src/
│   ├── lib/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── types.ts
│   │   │   └── index.ts       # Barrel: exports Button public API
│   │   ├── hooks/
│   │   │   ├── useToggle.ts
│   │   │   └── index.ts       # Barrel: exports hooks
│   │   ├── types/
│   │   │   └── index.ts       # Barrel: exports shared types
│   │   └── index.ts           # Barrel: lib public API
│   ├── storybook/             # Storybook-specific files (not exported)
│   └── index.ts               # Re-exports from lib
└── package.json
```

Re-export from the lib folder in the package entry point
```typescript
// src/index.ts
export * from "./lib/index.js";
```

Use the lib barrel to compose the package's public API from domain barrels
```typescript
// src/lib/index.ts
export * from "./Button/index.js";
export * from "./hooks/index.js";
export type * from "./types/index.js";
```

### Don't

Use alternative folder names like `ui`, `components`, or `utils` for exportable code at the package level
```
// Bad: Using 'ui' instead of 'lib'
packages/my-package/
├── src/
│   ├── ui/              # Wrong: should be 'lib'
│   │   └── Button/
│   └── index.ts
```

Mix exportable and non-exportable code at the same level
```
// Bad: Mixing concerns
packages/my-package/
├── src/
│   ├── Button/          # Component mixed with...
│   ├── storybook/       # ...non-exportable storybook config
│   └── test-utils/      # ...and test utilities
```

Create deeply nested lib-like structures; keep lib at the top level of src
```
// Bad: Nested lib folders
packages/my-package/
├── src/
│   ├── features/
│   │   └── lib/         # Wrong: lib should be at src level
```

Omit barrels from domain folders within lib
```
// Bad: no barrels — consumers must know individual file paths
packages/my-package/
├── src/
│   ├── lib/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   └── types.ts    # No index.ts — fragile imports
│   │   ├── hooks/
│   │   │   └── useToggle.ts # No index.ts
│   │   └── index.ts
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

Files that contain a single export must be named after that export. This applies to functions, classes, types, constants, and any other single-export module. The file name must match the exported identifier exactly, preserving its casing (camelCase for functions/variables, PascalCase for classes/types/components).

### Do

Name files after the single function they export
```typescript
// isAccepted.ts
export const isAccepted = (status: string): boolean => {
  return status === "accepted";
};

// formatCurrency.ts
export default function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}
```

Name files after the single type or interface they export
```typescript
// ConnectionConfig.ts
export interface ConnectionConfig {
  host: string;
  port: number;
}

// UserRole.ts
export type UserRole = "admin" | "editor" | "viewer";
```

Name files after the single class they export
```typescript
// EventEmitter.ts
export class EventEmitter {
  // ...
}
```

Name files after the single constant they export
```typescript
// DEFAULT_TIMEOUT.ts
export const DEFAULT_TIMEOUT = 5000;
```

### Don't

Use generic names like `helpers.ts`, `utils.ts`, or `types.ts` for files with a single export
```typescript
// helpers.ts — wrong: should be isAccepted.ts
export const isAccepted = (status: string): boolean => {
  return status === "accepted";
};

// utils.ts — wrong: should be formatCurrency.ts
export default function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}
```

Use names that describe the domain instead of the export
```typescript
// validation.ts — wrong: should be isAccepted.ts
export const isAccepted = (status: string): boolean => {
  return status === "accepted";
};

// network.ts — wrong: should be ConnectionConfig.ts
export interface ConnectionConfig {
  host: string;
  port: number;
}
```

---

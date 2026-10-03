# Design System Ontology

An OWL ontology for modeling UI design systems as structured, queryable knowledge graphs. Built to bridge the gap between design specifications and implementation by establishing a shared semantic vocabulary for components, patterns, layouts, and their relationships.

**Core Philosophy:** A design system is more than a component library - it's a formal language. By modeling UI elements ontologically, we enable machine-readable specifications, automated consistency checking, and intelligent tooling that understands design intent.

---

## Quick Start

### 1. Core Concepts

The ontology organizes UI elements into a hierarchy:

```
UIElement (root)
└── UIBlock (visual/abstract entity for composing UIs)
    ├── Component  - Implementable UI piece (Button, Badge, Card...)
    ├── Pattern    - Reusable solution to UX problems
    ├── Layout     - Opinionated space division for navigation
    ├── Subcomponent - Part of a parent component
    └── Group      - Repeating series of one sibling block (Cards, Tiles...)
```

Components are organized by **Tiers** (scope/applicability) and can be customized through **ModifierFamilies** (variant axes). The diagram is an overview, not the class list — run `pragma ontology lookup ds` for the full hierarchy (Modifier and ModifierFamily sit under UIElement too).

### 2. Defining a Component

```turtle
@prefix ds: <https://ds.canonical.com/> .

ds:global.component.button a ds:Component ;
    ds:name "Button" ;
    ds:summary "Buttons trigger actions within an interface" ;
    ds:tier ds:global ;
    ds:hasModifierFamily ds:global.modifier_family.importance ;
    ds:usage """### When to use
For primary actions that transform or submit data

### When not to use
For navigation - use links instead""" .
```

### 3. Tiered Organization

Components belong to tiers that define their scope — `global` blocks are universal,
the `apps*` tiers scope application UI (shared or per-app), and further tiers cover
their own surfaces. The tier set is live graph data; query it, never copy it:

```bash
pragma tier list   # every tier that exists today, with display names
```

### 4. Modifier System

Modifiers provide systematic variation through **ModifierFamilies**:

```turtle
ds:global.modifier_family.importance a ds:ModifierFamily ;
    ds:name "Importance" ;
    ds:hasModifier ds:global.modifier.primary,
                    ds:global.modifier.secondary,
                    ds:global.modifier.tertiary .

ds:global.component.button
    ds:hasModifierFamily ds:global.modifier_family.importance .
```

The families and their values are live graph data:

```bash
pragma modifier list             # every family with its values
pragma modifier lookup <Family>  # one family in full — take the name from the list output
```

---

## How-To Guides

### How to Add a New Component

1. Determine the appropriate tier based on scope
2. Draft the spec as a standalone file under `specs/` (see `specs/README.md`) — never
   hand-edit `data/`, it is regenerated destructively from Coda; a human enters the
   finished spec into Coda
3. Define required properties: name, summary, tier
4. Link to applicable modifier families
5. Add usage guidelines (`ds:usage`, with `### When to use` / `### When not to use`
   sub-sections)

```turtle
@prefix ds: <https://ds.canonical.com/> .

ds:apps.component.file_tree a ds:Component ;
    ds:name "FileTree" ;
    ds:summary "Hierarchical file browser for navigating directory structures" ;
    ds:tier ds:apps ;
    ds:usage "### When to use\nWhen users need to navigate nested file hierarchies" ;
    ds:figmaLink <https://figma.com/file/...> .
```

### How to Define a Layout

Layouts define how space is divided for a domain of information:

```turtle
ds:apps.layout.sidebar a ds:Layout ;
    ds:name "Sidebar Layout" ;
    ds:domain "Application navigation" ;
    ds:grid "1fr 4fr" ;
    ds:gridAreas "sidebar main" ;
    ds:targetDevices "desktop, tablet" .
```

### How to Create a Pattern

Patterns are reusable solutions to UX problems:

```turtle
ds:global.pattern.empty_state a ds:Pattern ;
    ds:name "Empty State" ;
    ds:summary "Guidance shown when a container has no content" ;
    ds:tier ds:global ;
    ds:usage "### When to use\nWhen a list, table, or container is empty" ;
    ds:guidelines "Include illustration, message, and action" .
```

### How to Model Component Composition

Use subcomponents for parts that belong to a parent — the live Card.Header, for
example:

```turtle
ds:global.subcomponent.card-header a ds:Subcomponent ;
    ds:name "Card.Header" ;
    ds:parentComponent ds:global.component.card .
```

Only parts a user instantiates in their own code (`<Card.Header>`) get a
subcomponent entry; a part the user cannot write as `<Parent.Part>` belongs in the
parent's anatomy as an anonymous role, not here (Button's icon is a role, not a
subcomponent).

### How to Query the Design System

Using the pragma CLI:

```bash
# every component, pattern, layout and subcomponent, with its type and tier
pragma block list

# Every triple on a specific block
pragma graph inspect ds:global.component.button

# Arbitrary SPARQL — e.g. components drawing from a modifier family (a local
# name with more than one dot does not parse in a query body; use the full IRI)
pragma graph query "SELECT ?c WHERE { ?c ds:hasModifierFamily <https://ds.canonical.com/global.modifier_family.criticality> }"
```

---

## Reference

### Classes

| Class | Description |
|-------|-------------|
| `UIElement` | Root class for all design system entities |
| `UIBlock` | Visual/abstract entity for composing UIs |
| `Component` | Implementable UI piece |
| `Pattern` | Reusable UX solution |
| `Layout` | Space division for navigation |
| `Subcomponent` | Part of a component |
| `Modifier` | Variant option |
| `ModifierFamily` | Grouping of related modifiers |
| `Tier` | Scope/applicability level |
| `Property` | Configurable component property |
| `ImplementationObject` | Platform-specific implementation |
| `ImplementationLibrary` | Implementation library |
| `TokenBinding` | One symbol a block consumes, at one node, key, state and rank |

Run `pragma ontology lookup ds` for the full class list with today's instance
counts (it also carries classes this overview omits).

### UIBlock Properties

| Property | Range | Description |
|----------|-------|-------------|
| `name` | string | Display name (from `Entity`) |
| `summary` | string | What this block is/does (from `Entity`) |
| `tier` | Tier | Scope classification |
| `usage` | string | Usage guidance (`### When to use` / `### When not to use` sections) |
| `guidelines` | string | Design guidelines |
| `figmaLink` | anyURI | Link to Figma designs |
| `anatomyDsl` | string | Anatomy in the Anatomy DSL (YAML) |
| `anatomyClassic` | string | Anatomy as links/prose |
| `hasVariant` | UIBlock | Variant blocks |
| `hasModifierFamily` | ModifierFamily | Applicable variant axes |
| `hasProperty` | Property | Configurable properties |

Run `pragma ontology lookup ds --class UIBlock` for the full declared set —
`documentationStage`, `changeLog`, and the variant/inheritance links are there too
(`name` and `summary` are inherited from `Entity`; `--class Entity` shows them).

### Layout-Specific Properties

| Property | Range | Description |
|----------|-------|-------------|
| `domain` | string | Information domain |
| `grid` | string | CSS grid definition |
| `gridAreas` | string | Named grid areas |
| `targetDevices` | string | Supported devices |

### Component Relationships

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `hasSubcomponent` | Component | Subcomponent | Composition |
| `parentComponent` | Subcomponent | Component | Inverse of above |
| `hasModifierFamily` | UIBlock | ModifierFamily | Variant axes |
| `hasModifier` | ModifierFamily | Modifier | Variant options |

### Implementation Bridge

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `implementsBlock` | ImplementationObject | UIBlock | Links code to spec |
| `library` | ImplementationObject | ImplementationLibrary | Source library |
| `libraryTier` | ImplementationLibrary | Tier | Library's tier |

### Token Bindings

`ds:TokenBinding` records are **derived**, not authored: `deriveTokenBindings`
(`src/transform/tokenBindings.ts`) is their only writer and runs as a post-step of the
transform, parsing each block's `ds:anatomyDsl` literal with `@canonical/anatomy-dsl`
and following its `uri:` references transitively. A record is a blank node in the
block's own per-instance file.

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `hasTokenBinding` | UIBlock | TokenBinding | A symbol this block consumes |
| `consumesSymbol` | TokenBinding | `dt:TokenSymbol` | The symbol — exactly one, determined by the identity |
| `viaBlock` | TokenBinding | UIBlock | The tree it was reached through; equal to the block for an own-tree binding |
| `node` | TokenBinding | string | The node's tree path (`$root/nav list/level-1 entry/link`) |
| `styleKey` | TokenBinding | string | `anatomy:styleKey`, reused from the anatomy vocabulary |
| `styleState` | TokenBinding | string | `anatomy:styleState`; `"default"` for the unmarked key |
| `rank` | TokenBinding | integer | 1-based position in the value's fallback order |

The identity is the six-tuple `(block, viaBlock, node, styleKey, styleState, rank)`;
`consumesSymbol` is functionally determined by it. An inherited binding is therefore
just `FILTER(?via != ?block)`:

```sparql
SELECT ?block ?key ?sym WHERE {
  ?block ds:hasTokenBinding ?b .
  ?b ds:consumesSymbol ?sym ; anatomy:styleKey ?key ; ds:viaBlock ?via .
  FILTER(?via != ?block)
}
```

The node is a **path**, not a role, because a role alone collides:
`global.pattern.table_of_contents` binds `role: link` at three depths with identical
styles. No parsed anatomy tree is written to the graph — the literal ships, and a
consumer that wants the tree parses it with the package.

---

## Explanation

### Why an Ontology?

After a decade using Vanilla Framework (CSS library), Canonical observed that visual consistency worked well but led to challenges:

1. **Inconsistent terminology** - Same component, different names across teams
2. **Implicit relationships** - Component composition undocumented
3. **Lost design rationale** - Why decisions were made
4. **Fragmented specifications** - Figma, docs, code out of sync

An ontology addresses these by:
- **Establishing shared vocabulary** - One name, one meaning
- **Explicit relationships** - Queryable component graph
- **Structured metadata** - Guidelines, rationale, links preserved
- **Machine-readable specs** - Enables tooling and validation

### Design Principles

**1. Separation of Concept and Implementation**

The ontology separates the *what* (UIBlock) from the *how* (ImplementationObject). A Button concept can have multiple implementations across React, Web Components, or Flutter while maintaining semantic identity.

**2. Tiered Scoping**

Not all components belong everywhere. Tiers make scope explicit - global components are universal, while apps-tier components may not make sense on marketing sites.

**3. Systematic Variation**

ModifierFamilies provide principled variation. Instead of ad-hoc props like `isImportant`, `isPrimary`, `variant="critical"`, the ontology models Importance and Criticality as distinct axes that components can opt into.

**4. Documentation as Data**

Usage guidelines, when-to-use patterns, and design rationale are first-class properties - queryable, versionable, and programmatically accessible.

---

## Architecture

```
design-system/
├── definitions/
│   └── ontology.ttl          # TBox: Classes, properties
├── data/                     # Instance data — regenerated from Coda, never hand-edited
│   ├── global/               # Global tier instances
│   │   ├── component/        # Button, Badge, Card...
│   │   ├── subcomponent/     # Card.Header, Accordion.Item...
│   │   ├── group/            # Cards, Tiles...
│   │   ├── pattern/          # Empty state, Loading...
│   │   ├── layout/           # Grid layouts
│   │   ├── modifier/         # Primary, Secondary...
│   │   ├── modifier_family/  # Importance, Criticality...
│   │   └── ...               # Other block classes
│   ├── apps/                 # Apps tier
│   ├── sites/                # Sites tier
│   └── ...                   # Other tiers
├── specs/                    # Drafted block specs — not read by build or sync
├── src/                      # Build, sync, and collector source (TypeScript)
├── examples/                 # Example files (sync target projection)
└── README.md                 # This file
```

### Namespaces

```turtle
@prefix ds: <https://ds.canonical.com/> .  # Unified namespace for ontology and instances
```

### URI Convention

Instances follow the pattern: `{tier}.{class}.{name}`

```
ds:global.component.button
ds:apps.layout.application_layout
ds:global.modifier_family.importance
```

### Dependencies

Runtime dependencies are declared in `package.json`; read them there, never from this
file.

Two of them carry the anatomy–token seam. `@canonical/anatomy-dsl` supplies the
anatomy parser, the value grammar (`liftSymbols`) and the style-key roster
(`STYLE_KEYS`, `takesToken`, `definitions/registry.ttl`); `@canonical/token-ontology`
supplies the token strata as data (`data/s1.ttl`, `data/s2.ttl`, `data/s4.web.ttl`).
Both are reached through `import.meta.resolve`, never by a path into `node_modules`
and never by copying a file into this repository.

> **The anatomy-dsl dependency is still a local `file:` link, and that is a finding
> rather than a choice.** `@canonical/anatomy-dsl@0.5.0` is published, but its tarball
> ships no `dist/` — `files` lists it and `exports["."]` points at
> `./dist/esm/index.js`, and neither is in the package — so importing the package root
> fails with `Cannot find package` and `tsc` reports `TS2307` in every module that
> imports it. The swap to `"^0.5.0"` is one line and is blocked on a `0.5.1` published
> after a build. `@canonical/token-ontology` is already on its published range.

---

## The anatomies: authored, validated, written

The anatomies are written by hand, one file per anatomy, from the component's
implementation. Reading an implementation and choosing the node, the key and the symbol
it should bind is judgement, so it happens in the file, under review, rather than in a
derivation.

```bash
# The law over the corpus, and the one writer of anatomies/register.yaml and
# anatomies/census.json.
bun src/cli.ts anatomies validate [--write-register] [--only <uri>] [--json]

# The law over the authored files, offline, over one tier or over all of them.
bun src/cli.ts anatomies validate --authored [--tier <name>] [--json]

# The authored files into the document's anatomy_dsl cells. Dry by default.
bun src/cli.ts anatomies write [--apply] [--only <uri>] [--tier <name>] [--json]

# A snapshot of those cells, put back.
bun src/cli.ts anatomies restore <snapshot> [--apply] [--json]
```

`validate` is the gate: every symbol an anatomy binds resolves against the token graph,
every `uri:` names a block, every exception carries a register row, and the census's
floors hold. `ci.yml`'s `census-drift` job runs it with `--write-register` and diffs
`anatomies/census.json`.

**The files, and who writes them.**

| File | Writer | What it is |
|---|---|---|
| `anatomies/authored/<tier>/<uri>.yaml` | by hand | One anatomy each. Reviewed as files in a pull request, and the text of the file is the text of the `anatomy_dsl` cell the write sends |
| `anatomies/census.json` | `validate --write-register` | The corpus and its counts. The one committed generated file, and the one thing CI diffs |
| `anatomies/register.yaml` | `validate --write-register` | Every exception, with its hand-written rationale preserved. **Not committed** — most of its rows today are the parse failures of the retired notation, and they disappear as the anatomies are authored, so the file would land at many times its steady-state size. `readRegister` reads a missing file as an empty register, and the census carries the counts |
| `anatomies/snapshots/<stamp>-uiBlocks.json` | `write --apply`, `restore --apply` | What every `anatomy_dsl` cell said before the run touched it. Gitignored: a recovery artefact of one run against one document |

Nothing here writes `data/`, which is the Coda pull sync's alone, and nothing here
writes `anatomies/authored/`.

**The write, in the order it is meant to be run.** `anatomies write` is dry by
default: it reads the authored files, runs the law over them, reads the live
`uiBlocks` table and prints the plan — how many files were read, how many cells
already hold theirs, which cells would change, and any file whose `uri` names no row.
Read that, then write one anatomy as a canary with `--only <uri>` and look at the cell
in the document, and only then let the rest follow.

```bash
bun src/cli.ts anatomies write                                    # the plan
bun src/cli.ts anatomies write --only global.component.button --apply   # the canary
bun src/cli.ts anatomies write --apply                            # the rest
```

**A tier at a time, and this round is the top-level tiers.** `anatomies/authored/` is
split by tier, and only the top-level tiers' anatomies are written to the document
now: `global`, `apps` and `sites` — of which only `global` and `apps` have anything
authored yet, so those two are what this round's write names. The second-level
tiers — `apps_landscape`, `apps_launchpad`, `apps_lxd`, `apps_anbox` and
`sites_webcomponentsprototype` — stay
authored, reviewed and lawful in their directories, and no cell of theirs is sent.
`--tier <name>` is what says so: it takes one tier per occurrence, or a
comma-separated list, or any mix of the two (`--tier global --tier apps,sites`), and
it names the directory under `anatomies/authored/`, which is also the first dotted
segment of every `uri` in it. A tier that matches no authored file is refused, naming
the directory and the tiers it does hold, because a misspelt tier that quietly
planned zero cells reads exactly like a corpus already in step. It narrows the plan
and nothing else: the **law still runs over every authored file**, because a corpus is
lawful or not as a whole and writing a different anatomy out of it does not make an
unregistered symbol lawful — so an unlawful file in a tier this round leaves alone
still refuses the run. What is narrowed is the plan, and its counts and its header
line say which tiers they are of (`Anatomy cells — the authored anatomies against
uiBlocks.anatomy_dsl (tiers: global, apps)`). `--only` composes with it, inside the
tiers in force. On `validate --authored` the same flag narrows which files are READ,
so an author with one tier open gets that tier's answer and the others are never
opened.

```bash
bun src/cli.ts anatomies validate --authored --tier global   # one tier's law
bun src/cli.ts anatomies write --tier global,apps            # the plan for this round
bun src/cli.ts anatomies write --tier global,apps --apply    # and the write
```

`--apply` is refused, with the reason named, when `CI` is set (the write is an act
with a human reading the plan, never a pipeline step), when `CODA_WRITE_TOKEN` is
unset, when the law reports a finding (a warning prints and the run proceeds), when an
authored file names no row in the document, and when the plan is empty. When every
gate is open it writes `anatomies/snapshots/<stamp>-uiBlocks.json` — every live row's
row id, `uri` and cell — **before** its first write, then updates the cells one call
at a time, then re-reads and checks that every cell it wrote reads back as its file.
Coda answers 202 and queues a write, so that re-read is the only thing standing
between a write it silently dropped and a run that claims success.

**Where it writes comes from `source.json`, and nowhere else.** The root
configuration already says all four things the write needs, and they are read through
the same `validateConfig` every other command reads it through: the document id, the
`uiBlocks` table id under `extract.tables`, the column that carries the anatomy — the
`@context` key mapped to `ds:anatomyDsl` in `transform.tables.uiBlocks` — and the
column a row's subject is built from, which is the placeholder in that table's
`uriTemplate`. So the write plans against the same table and the same cell the pull
sync reads, by construction, and a rename in the document is one edit rather than two.
Column ids are learned at run time from the table itself, because a cell keyed by
display name is accepted with a 202 and changes nothing.

`anatomies restore <snapshot>` is the other half: it plans the cells that differ from
a snapshot, behind the same gates, and takes a fresh snapshot of its own before it
writes — a restore is a write too, and restoring the wrong file has to be undoable.
It only ever writes the `anatomy_dsl` column, and it never creates a row: the roster
of blocks is the pull sync's.

The whole write path — its READS included — runs on `CODA_WRITE_TOKEN`, a write-scoped
token for the one document, kept in the gitignored `.env`. It never touches
`CODA_API_KEY`, the read-only key CI and the daily sync hold, which is what keeps that
credential un-escalatable by any code path that reaches for a write.

---

## Data Pipeline

The design system data is extracted from Coda and transformed to RDF:

```bash
bun install

# Create .env with Coda API key
echo "CODA_API_KEY=your-token" > .env

# Extract and transform
bun run ds:list        # List available tables
bun run ds:extract     # Extract to JSON
bun run ds:transform   # Transform to JSON-LD/Turtle
```

---

## Implementation Collector

The `collect-implementations` script scans codebases for `@implements` annotations and generates RDF linking implementations to their design system specifications.

### Setup

1. Create a `design-system.json` config file in your project root:

```json
{
  "name": "my-component-library",
  "platform": "react",
  "description": "React implementation of the design system",
  "link": "https://github.com/org/my-library",
  "documentation": "https://docs.example.com/components",
  "tier": "ds:global",
  "prefix": {
    "short": "ds",
    "namespace": "https://ds.canonical.com/"
  },
  "pattern": "src/**/*.tsx",
  "outputDir": "data"
}
```

### Configuration Options

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Library identifier (e.g., "pragma-react") |
| `platform` | Yes | Framework/platform (react, vue, angular, etc.) |
| `description` | No | Human-readable library description |
| `link` | Yes | Main repository or package URL |
| `documentation` | No | Documentation URL if different from link |
| `tier` | No | Design system tier reference (e.g., "ds:global") |
| `prefix.short` | Yes | Namespace prefix used in annotations (e.g., "ds") |
| `prefix.namespace` | Yes | Full namespace URI |
| `pattern` | Yes | Glob pattern for files to scan |
| `outputDir` | No | Output directory for .ttl files (default: "data") |

### Annotating Components

Add `@implements` annotations as comments in your component files:

```tsx
// @implements ds:global.component.button
export function Button({ children, ...props }) {
  return <button {...props}>{children}</button>;
}
```

Annotation formats:
- Basic: `// @implements ds:global.component.button`
- With version: `// @implements ds:global.component.button@1.0.0`
- Draft status: `// @implements ds:global.component.button [draft]`

### Running the Collector

From within your project directory (where `design-system.json` is located):

```bash
# Using bun directly
bun /path/to/design-system/src/collect-implementations.ts

# Or if installed globally/linked
collect-implementations
```

### Output

The collector generates two Turtle files in the configured output directory. With the
config and annotation from the sections above, it emits (verbatim, after each file's
`@prefix` header):

1. **`implementationLibrary.ttl`** - Defines the implementation library under
   `<namespace>implementation.library.<slug>`:
   ```turtle
   ds:implementation.library.my-component-library a ds:ImplementationLibrary;
       ds:libraryName "my-component-library";
       ds:platform "react";
       ds:link "https://github.com/org/my-library";
       ds:summary "React implementation of the design system";
       ds:documentation "https://docs.example.com/components";
       ds:libraryTier ds:global.
   ```

2. **`implementationObjects.ttl`** - Attaches each annotated file to the library as
   a blank-node `ds:ImplementationObject` (`ds:headLink` carries the file's relative
   path):
   ```turtle
   ds:implementation.library.my-component-library ds:hasImplementation [
           a ds:ImplementationObject;
           ds:implementsBlock ds:global.component.button;
           ds:headLink "src/components/Button.tsx"
       ].
   ```

### Example Workflow

```bash
# 1. Navigate to your component library
cd my-react-library

# 2. Add annotations to components
echo '// @implements ds:global.component.button' >> src/Button.tsx

# 3. Run the collector
bun ~/code/cn/design-system/src/collect-implementations.ts

# Output:
# Scanning src/**/*.tsx for @implements annotations...
# Found 1 valid implementation(s):
#   - ds:global.component.button
# Written: data/implementationLibrary.ttl
# Written: data/implementationObjects.ttl
# Done!
```

---

## CI: Automated Coda Sync

Two GitHub Actions workflows keep the design system data in sync with Coda:

- **Scheduled** — runs daily at 06:00 UTC
- **Manual** — trigger from the Actions tab via "Run workflow"

Both run `bun run build` (extract + transform) and commit any changes to `data/`.

### Fail-closed guards

`data/` is fully regenerated on every sync, so a broken extract (expired API
token, renamed grid, partial API response) could silently destroy committed
spec data. Five independent layers prevent that.

They divide the work along one line: **a row that asserts nothing is skipped;
a row that asserts something but cannot be emitted fails the sync.** A row
with no name is not a thing yet — every Coda grid accumulates such rows,
because clicking into the last row of a grid creates one — and halting the
pipeline over it costs a human deletion to clear. A row that carries a name is
something the document says exists, so losing it must be loud.

1. **Expected-table manifest** — the transform derives the set of tables it
   expects from `source.json` (outputs, references, and `@inline` embeds) and
   hard-fails if any is missing from the extract
   (`src/transform/expectedTables.ts`).
2. **Delta guards** — the new dataset is staged in a temp directory and
   compared against the committed `data/` *before* anything is deleted. The
   transform aborts when a non-empty table yields zero subjects, the subject
   count drops >10%, any tier file disappears, or the triple count drops >5%
   (`src/transform/deltaGuards.ts`, `src/transform/collectDataMetrics.ts`).
3. **Identity filters** — each table declares, in `source.json`, the column
   that carries a row's identity (`rowFilter.nonEmpty`). A row whose identity
   column is empty is excluded before transformation: it is not a subject and
   never becomes one, so it can neither produce a degenerate IRI nor trip the
   guard below. The count of excluded rows is reported on every sync and
   appears in the job summary, so blanks stay visible without ever being
   fatal (`src/transform/rowFilter.ts`,
   `src/transform/reportFilteredRows.ts`). Deleting them upstream is optional
   tidying. Every configured table must declare such a filter, which
   `src/transform/identityFilter.tests.ts` enforces: a table without one is a
   latent outage.
4. **Malformed-row guard** — a row whose `uri` is *present but degenerate*
   (a blank or dangling upstream reference leaves empty dot-separated
   segments, e.g. `ds:global..`) cannot be emitted as valid Turtle, so the
   transform drops it and its subject silently disappears from `data/`. The
   threshold is **zero**: one such row fails the sync, naming the offending
   URI and its table, so the defect is fixed at the source instead of
   surfacing later as an unexplained deletion count
   (`src/transform/deltaGuards.ts`, `src/transform/classifySubjectUri.ts`).
   A row with **no** `uri` at all is a routine skip (a trailing blank grid
   row) and is not counted. Its sibling, the **untypable-row guard**, covers
   the other way a named row vanishes: its identity resolves but its `type`
   column is empty or dangling, so it cannot be given an RDF class. Same
   threshold of zero, same escape hatch. Before it existed such a row was
   dropped in total silence — no warning, no count, no failure.
5. **Workflow content-loss guard** — after regeneration, the sync workflow
   checks the staged git diff and refuses to commit when the sync *loses*
   committed content: deletions that nothing added back, measured as **net
   loss** (deleted − added) against a share of the committed corpus, with an
   absolute ceiling as a catastrophic backstop
   (`src/scripts/evaluateDataDeletion.ts`). Content rewritten in place —
   large deletions with comparable additions, which is what re-derived
   authored literals look like — passes; content that simply disappears does
   not. Being a proportion, it does not need raising as the corpus grows.

On any guard failure the run fails without committing, the job summary names
*which* guard tripped and what to fix, and an issue is opened/annotated with
the same text.

#### Escape hatches

Both loss-shaped guards are fail-closed by default and share one escape
hatch; the two row-level guards share a second one, so that allowing an
intentional mass deletion does not also wave through rows the source is
losing by accident. Identity filters have no escape hatch and need none —
they never fail a sync.

| Situation | Manual workflow input | Environment variable |
| --- | --- | --- |
| Intentional large deletion (a planned cleanup in Coda) | `allow_shrink` | `SYNC_ALLOW_SHRINK=1` |
| Known-malformed upstream rows that cannot be fixed yet | `allow_malformed_rows` | `SYNC_ALLOW_MALFORMED_ROWS=1` |
| Named rows whose `type` cannot be filled in yet | `allow_malformed_rows` | `SYNC_ALLOW_MALFORMED_ROWS=1` |

Either input downgrades its guard to a warning for that run. Locally:
`SYNC_ALLOW_SHRINK=1 bun run build`. Scheduled runs never set either one.

The content-loss thresholds can also be overridden per run with
`SYNC_MAX_NET_LINE_LOSS_RATIO`, `SYNC_MAX_NET_FILE_LOSS_RATIO` and
`SYNC_MAX_NET_DELETED_LINES`; prefer the escape hatch, which leaves the
defaults intact.

### Setting up the two API tokens

There are two, and the split is the point: CI holds a read-only token, and the token
that can write is never in CI.

**`CODA_API_KEY` — read only, held by CI.** Used by `ds:extract`, `ds:list`,
`ds:transform` and the daily pull sync.

1. Go to <https://coda.io/account>
2. Scroll to **API settings**
3. Click **Generate API token**
4. Name it `ci-access-token`
5. Add a restriction:
   - Type: **Doc or table**
   - Access: **Read only**
   - Doc ID: the full `_d`-prefixed value from the Coda URL — for example, given `https://coda.io/d/Design-System-Database_dNyzE_TLZDh/`, the ID is `_dNyzE_TLZDh`. Verify by navigating to `https://coda.io/d/_dNyzE_TLZDh`
6. Copy the token, then in your GitHub repo go to **Settings > Secrets and variables > Actions** and create a secret named `CODA_API_KEY` with the token value

**`CODA_WRITE_TOKEN` — read and write, local only.** Used by `anatomies write` and
`anatomies restore`, for their reads as well as their writes. The same steps, with
**Read/Write** access and the same document restriction, and it goes in the gitignored
`.env` — never in CI, and never in a workflow secret.

> **The API host is the workspace's own**, `https://docs.superhuman.com/apis/v1`, not
> `coda.io`. The two do not answer for the same state: a read against `coda.io`
> returns a stale view of this workspace, and a write against it is accepted with a
> 202 and never applies. `CODA_API_BASE` in `src/providers/CodaProvider.ts` is the one
> place that says so, and a test asserts it.

---

## Version

The current version lives in `package.json` — read it there, never from this file.

## References

- [Canonical's Design System: Towards a Design System Ontology](https://discourse.ubuntu.com/t/canonicals-new-design-system-towards-a-design-system-ontology/70367)
- [Vanilla Framework](https://vanillaframework.io/)

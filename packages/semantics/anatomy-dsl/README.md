# Anatomy DSL

A YAML-based DSL for representing design system component anatomies — platform-agnostic structural primitives that precede implementation.

## Quick Example

```yaml
---
node:
  uri: global.component.button
  styles:
    layout.type: inline-flex
    layout.align: center
    spacing.internal.inline.start: spacing.inset.action.inline
    appearance.background: [modifier.color.foreground.primary, color.foreground.primary]
    appearance.radius: dimension.radius.medium
  edges:
    - node:
        uri: global.subcomponent.button-icon
      relation:
        cardinality: "0..1"
        slotName: icon
    - node:
        role: label text
      relation:
        cardinality: "1"
        slotName: default
```

Style values are **token symbols**, written in the symbol's own dotted
spelling: `dimension.radius.medium`, `color.foreground.primary`. A list is
the **fallback order** — a one-to-one transcription of the implementation's
own `var()` chain, so `[modifier.color.foreground.primary,
color.foreground.primary]` says "read the primary-foreground channel, and
fall back to the primary foreground token", which is what the reference CSS
does. A **channel** (`modifier.*`, `surface.*`) is a symbol like any other:
the anatomy consumes it by name where the implementation reads the channel,
and the semantic token by name where it reads the token — nothing is
inferred. Primitives like `inline-flex` and `center` are used for layout
semantics that do not vary across themes, and one may end a list where the
implementation's chain ends in a literal
(`[modifier.color.icon, modifier.color.text, currentColor]`).

Keys come from a **closed roster** — `definitions/style-keys.yaml`, from
which `definitions/registry.ttl` is generated. The roster is measured, not
designed: its 111 keys are the right-hand column of a table whose left-hand
column was every CSS property bound on a component selector across 89
published component stylesheets, so a key exists because an implementation
binds the property. That measurement lives in `canonical/design-system`,
where the reference stylesheets are an input; this package reads no CSS and
holds the roster, with its provenance stated in both files. The
slash-delimited path and the trailing `?` marker of earlier versions are
retired — see `docs/api-reference.md` §5, §11 and §12.

## Projections

Projections bind the anatomy tree directly to graph data, after the Relay
fragment-colocation pattern: the tree carries its data requirements the way a
lens component carries its fragment.

```yaml
---
node:
  uri: global.component.entity-card
  projection:
    on: Component            # type condition — the tree is a view over one Component
  edges:
    - node:
        uri: global.subcomponent.entity-card-header
        projection:
          field: _meta.title # this node renders the entity's title
      relation:
        cardinality: "1"
        slotName: header
    - node:
        uri: global.component.chip
        projection:
          field: _meta.title # relative to the traversed Tag
      relation:
        cardinality: "0..*"
        slotName: tags
        projection:
          field: documentationStages  # traversal populating the slot
```

Semantics:

- The **root node's** `projection.on` establishes the data context — the anatomy
  is a parameterized view over one entity of that GraphQL type, like
  `fragment EntityCard on Component`. Children inherit the context.
- `projection.field` on a **relation** is a traversal: the slot is populated
  from that field of the current context. The DSL names the field only —
  never `edges.node`. Anatomy cardinality ↔ graph multiplicity is the Relay
  pattern taken one level further.
- **Cardinality decomposes against the schema.** The upper bound claims
  multiplicity: `..1` maps to an object or scalar field, `..*` to a
  connection or list. The lower bound claims nullability: `0..` tolerates
  `null`, `1..` requires the provider to always have the value. So
  `field: _meta.title` may sit under `cardinality: "1"` (title is total in
  the contract), but a nullable field like `summary` must sit under `0..1`.
  `1..*` asserts a non-empty list — deliberately stronger than GraphQL can
  express, and checkable only at runtime.
- **Mechanism-blindness.** Whether a plural field is a Relay connection
  (`subcomponents`) or a plain list (`properties`) is a provider mechanism,
  not an anatomy fact. Consumers discover the shape from the SDL and unwrap
  `edges { node }` when needed; an anatomy survives a provider promoting a
  list to a connection unchanged.
- `projection.on` on a **child node** narrows the traversed entity's type — the
  analog of an inline fragment. Switch cases carrying different `on` values
  mirror an interface resolved through inline fragments.
- `projection.field` on a **node** means the node renders that field's value,
  as a dot-delimited path relative to the enclosing context (`_meta.title`).
- A node projection needs at least one of `on` / `field`; a relation projection
  requires `field` and admits no type condition (narrowing belongs on the
  child node).

Field names are anchored to the provider schema the docsite runs against
(compiled with `prefixing: "none"`); the committed SDL is the naming authority.

A fully projected anatomy **derives a GraphQL fragment** mechanically — the
example above reads as:

```graphql
fragment EntityCardAnatomy on Component {
  _meta { title }                        # header node
  documentationStages {                  # tags relation (connection per SDL)
    edges { node { _meta { title } } }   #   each chip
  }
}
```

The derivation rules (type conditions, dot-path expansion, connection
unwrapping, inline fragments) are specified in the API reference §3.10
*Derived fragment*; a worked gallery of every projection form is in §13, and
`examples/yaml/entity-card.anatomy.yaml` is the golden example.

## Props (pinned values)

A named node can **pin** props of the component it references — fixing a prop
value at one tree position:

```yaml
node:
  uri: global.component.icon
  props:
    icon: chevron-down
```

This is how icons become idiomatic with zero icon-specific machinery. The
design system models the icon as a component whose glyph is a required prop
(`ds:global.component.icon` › `ds:hasProperty [ ds:name "icon" ]`), so icon
usage in anatomies splits into exactly two cases:

- **Consumer-filled icon slot** — an icon-component edge with a slot and no
  pin. The consumer chooses the glyph; the anatomy correctly says nothing.
- **Component-intrinsic icon** — the accordion chevron, the modal close ×, a
  status glyph: the component's own spec fixes the glyph, and the anatomy
  pins it.

Semantics:

- Pins live on **named nodes only** — anonymous nodes have no prop surface.
  This is enforced in the types, the parser, and SHACL.
- The DSL **never defines a prop surface** (names, types, optionality live in
  the design system ontology); it only asserts values. Whether a pinned prop
  exists on the component, and whether a value is admissible (e.g. a glyph
  name in the icon set), are consumer-side checks against the DS graph — the
  same posture as projection checking against the provider SDL.
- Values are scalars, coerced to strings — no symbols and no fallback lists: a pin is a value, not a style.
  Pins are *values with meaning*, not styles: a theme may reskin what
  `chevron-down` looks like (asset layer), but never remap which glyph an
  anatomy means.
- A **data-driven** value is a projection (`projection: { field: … }`), and a
  **state-driven** one is a `switch` — pinned props are static by design.

In TTL, pins reify like styles do: `hasProp [ a :Prop ; propName "…" ;
propValue "…" ]`. See `examples/yaml/status-header.anatomy.yaml` for
intrinsic icons, a status-glyph switch, and an unpinned consumer slot in one
anatomy.

## Interaction states

Interaction states re-value style channels — they never add structure. A
style key takes an `@state` suffix scoping its value to a state; the unmarked
key is the default state:

```yaml
styles:
  interaction.cursor: pointer
  interaction.cursor@disabled: not-allowed
  appearance.background: [modifier.color.foreground.primary, color.foreground.primary]
  appearance.background@hover: color.foreground.primary.hover
  appearance.background@disabled: color.foreground.primary.disabled
  # A slot may read a channel only in one state.
  appearance.outline.color@focus: [modifier.color.focusRing, color.focusRing, currentColor]
```

The state vocabulary is **closed and registry-governed**: `hover`, `active`,
`focus`, `disabled`, `selected`, `expanded`, `indeterminate`, `invalid`.
Naming follows the industry consensus where systems diverge — `active`
subsumes Material's *pressed* and Spectrum's *down* (and matches Canonical's
own token tree); `focus` maps to CSS `:focus-visible` (Spectrum's
*key-focus*); `expanded` is a disclosure's open state (`[open]`,
`aria-expanded`); `indeterminate` is a mixed checkbox or progress bar, on
neither setting; `invalid` is a failed validation (`:invalid`,
`aria-invalid`). `@default` is not admitted — absence is the default.
Candidate additions (`checked`, `visited`, `dragged`, `pending`, `error`,
`read-only`) go through the registry, never by loosening the schema.

The boundaries that keep "state machines out of scope" true:

- **States hold style values only.** A state that changes the tree is not a
  state — it is a `switch on: internal` case (async-button's
  idle/loading/success/error). The DSL declares appearance *per* state, never
  transitions, triggers, or logic.
- **Gate vs appearance**: `props: { disabled: true }` (or the consumer) puts
  a node in the disabled state; `…@disabled` styles say how it looks there.
- A state-scoped value that differs from its base state's is a **lint, not a
  constraint**: it is reported with the ranks at which they differ and never
  rejected, because the reference does it — Button's `:disabled` reads
  `color.text.disabled`, a different symbol from its resting `color.text`.
- The grammar reserves repeatable markers for compound states
  (`@selected@hover`, canonical order: value/control state before user-action
  state); v1 permits a single `@`.

In TTL, the Style tuple gains one optional dimension:
`[ a :Style ; :styleKey "appearance.background" ; :styleState "hover" ; :styleValue "…" ]`.
See `examples/yaml/stateful-button.anatomy.yaml`.

## Install

```sh
bun add -D @canonical/anatomy-dsl
```

## Usage

```typescript
import { parse } from "yaml";
import { parseAnatomyYAML, anatomyToTTL } from "@canonical/anatomy-dsl";

const raw = parse(readFileSync("Button.anatomy.yaml", "utf8"));
const spec = parseAnatomyYAML(raw);
const ttl = anatomyToTTL(spec);
```

The button example above produces:

```turtle
@prefix : <https://anatomy.canonical.com/> .
@prefix dt: <https://dt.canonical.com/> .

[] a :Specification ;
    :rootNode [
        a :NamedNode ;
        :uri "global.component.button" ;
        :hasStyle
            [ a :Style ; :styleKey "layout.type" ; :styleValue "inline-flex" ] ,
            [ a :Style ; :styleKey "layout.align" ; :styleValue "center" ] ,
            [ a :Style ; :styleKey "spacing.internal.inline.start" ; :styleValue "spacing.inset.action.inline" ; :consumes ( dt:spacing.inset.action.inline ) ] ,
            [ a :Style ; :styleKey "appearance.background" ; :styleValue "[modifier.color.foreground.primary, color.foreground.primary]" ; :consumes ( dt:modifier.color.foreground.primary dt:color.foreground.primary ) ] ,
            [ a :Style ; :styleKey "appearance.radius" ; :styleValue "dimension.radius.medium" ; :consumes ( dt:dimension.radius.medium ) ] ;
        :hasEdge [
            a :Edge ;
            :edgeTarget [
                a :NamedNode ;
                :uri "global.subcomponent.button-icon"
            ] ;
            :hasRelation [
                a :Relation ;
                :cardinality "0..1" ;
                :slotName "icon"
            ]
        ] , [
            a :Edge ;
            :edgeTarget [
                a :AnonymousNode ;
                :role "label text"
            ] ;
            :hasRelation [
                a :Relation ;
                :cardinality "1" ;
                :slotName "default"
            ]
        ]
    ] .
```

## API

### `parseAnatomyYAML(raw: unknown): Specification`

Converts a parsed YAML object (from any YAML library) into the typed `Specification` structure. Handles field mapping between the YAML format and the TypeScript types.

### `anatomyToTTL(spec: Specification): string`

Pure function. Takes a `Specification`, returns a Turtle (RDF) string. No I/O, no side effects.

### Types

All types mirror the [OWL ontology](definitions/ontology.ttl) exactly:

| Type | Description |
|------|-------------|
| `Specification` | Root — contains exactly one `NamedNode` |
| `NamedNode` | Design system entity with a `uri` |
| `AnonymousNode` | Structural element with a `role` |
| `Node` | `NamedNode \| AnonymousNode` (discriminated on `type`) |
| `Edge` | Reified parent→child relationship |
| `Relation` | Cardinality and optional slot name |
| `Style` | Reified key-value tuple, with an optional interaction `state` dimension |
| `Switch` | Polymorphic position (discriminator: `props \| internal \| override`) |
| `SwitchCase` | One alternative within a switch |
| `Projection` | Fragment-style graph binding on a node (`on` type condition and/or `field` path) |
| `RelationProjection` | Traversal populating a slot (`field` required) |
| `Prop` | Pinned prop value on a named node (reified name-value tuple) |

## Repository Structure

```
definitions/   Turtle ontology (OWL) + SHACL shapes, the style-key roster and
               the registry generated from it, and the lift fixture — all of
               it public API, since exports lists it
docs/          API reference (WD404 + WD404.1 + WD404.2 + WD404.3)
examples/      Example anatomy files (YAML + Turtle pairs), the corpus the
               round-trip and SHACL tests read
src/           TypeScript types, parser, value grammar, transform and the
               generators
```

## Scope

The Anatomy DSL describes **structure**, **graph-data bindings** (projections
— what data each position renders), **pinned prop values** (props — fixed
component configuration at a position), and **state-scoped styles**
(interaction states — how channels re-value per state). It does not handle:

- **Prop surface definition** — which props a component accepts, their types
  and optionality live in the design system ontology; the DSL only pins values
- **State machines** — transitions, triggers, and interaction logic; the DSL
  declares appearance per state only, and structural state variation is the
  switch construct's job
- **Modifier descriptions** — only design token references are supported, not semantic modifier definitions

## Design Notes

Styles are modelled as reified key-value tuples
(`hasStyle [ a :Style ; :styleKey "…" ; :styleValue "…" ]`), which stays
lossless whatever the key roster becomes. Since 0.4.0 a tuple whose key takes
a token also carries `:consumes`, an ordered `rdf:List` of the `dt:` symbols
it reads: `:styleValue` is the authored spelling kept verbatim as evidence —
it is where a terminal literal lives, since a literal is not a symbol — and
`:consumes` is the form a query can walk. The key vocabulary is no longer
open: `anatomy:styleKey`'s `sh:in` is projected from the registry, so a key
outside the roster is a SHACL violation rather than a silent addition.

Projections and pinned props reuse the same reification idiom (`hasProjection [ projectionType "…" ; projectionField "…" ]`, `hasProp [ propName "…" ; propValue "…" ]`). Projections attach to both nodes and relations — the reified `Relation` is precisely what makes slot-level traversal annotations possible without changing the `Edge` class; pins attach to named nodes only.

## Specification Status

| Index   | Title                    | Status         |
|---------|--------------------------|----------------|
| [WD404](https://docs.google.com/document/d/1eFr-SNsAZyidnZzpWp1Jeegiat_SSM7mOW_G8p3nXo8/edit?tab=t.pndvuecem8cf)   | Anatomy DSL              | Approved       |
| [WD404.1](https://docs.google.com/document/d/1eFr-SNsAZyidnZzpWp1Jeegiat_SSM7mOW_G8p3nXo8/edit?tab=t.pndvuecem8cf) | Anatomy DSL — Addendum 1 | Pending Review |
| WD404.2 | Anatomy DSL — Projections | Draft (this repository) |
| WD404.3 | Anatomy DSL — Prop pinning | Draft (this repository) |

# Code Standards Ontology

An OWL ontology for software engineering standards as structured, queryable data.

## Core model

Each standard is identified by its compact prefixed subject, not by a separate slug property.

```text
CodeStandard
├── identifier   - compact prefixed IRI, e.g. cs:react.component.structure.folder
├── label        - human-readable title (rdfs:label, language-tagged), e.g. "Component Folder Structure"@en
├── description  - requirement and rationale
├── do / dont    - structured positive and negative examples
├── hasCategory  - compact category IRI, e.g. cs:react
└── extends      - optional parent standard
```

Categories are also compact identifiers such as `cs:react`, `cs:css`, `cs:code`, and `cs:rust`.

## Identifier convention

- Categories: `cs:{category}`
- Standards: `cs:{category}.{domain}.{topic}[.{subtopic}]`

Examples:

- `cs:react.component.structure.folder`
- `cs:css.selectors.namespace`
- `cs:storybook.story.naming`
- `cs:code.function.purity`
- `cs:rust.errors.context_enrichment`

Recommended pattern after the `cs:` prefix:

```regex
^[a-z]+(\.[a-z0-9_]+){1,}$
```

## Example definition

```turtle
@prefix cs: <http://pragma.canonical.com/codestandards#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

cs:react.component.structure.folder a cs:CodeStandard ;
    rdfs:label "Component Folder Structure"@en ;
    cs:hasCategory cs:react ;
    cs:description "Each component must reside in its own folder containing all related files." ;
    cs:do [
        cs:description "Place all component-related files within a single folder." ;
        cs:language "bash" ;
        cs:code """
Button/
  ├── Button.tsx
  ├── Button.stories.tsx
  ├── Button.test.tsx
  ├── index.ts
  ├── styles.css
  └── types.ts
        """
    ] ;
    cs:dont [
        cs:description "Scatter component files across different directories." ;
        cs:language "bash" ;
        cs:code """
components/Button.tsx
stories/Button.stories.tsx
styles/Button.css
        """
    ] .
```

## Authoring rules

- Use the subject IRI as the canonical identifier.
- Use snake_case inside multi-word IRI segments, not kebab-case.
- Use `rdfs:label` for the human-readable display title, language-tagged (`"…"@en`).
- Never use a label as a slug, lookup key, or duplicate identifier; the subject IRI is the only identifier.
- Do not use `cs:name`: it is deprecated in favour of `rdfs:label` (ontology 2.1.0) and kept only so a reader who meets it in an older graph is told what replaced it.
- Use `cs:hasCategory` with compact category IDs such as `cs:react`.
- Use `cs:extends` with compact standard IDs such as `cs:react.component.props`.
- Model examples as blank nodes with `cs:description`, optional `cs:language`, and optional `cs:code`.

## Adding a standard

1. Choose the category file in [data](data).
2. Pick a canonical compact identifier.
3. Add the standard with `cs:description`, `cs:do`, and `cs:dont`.
4. Use `cs:extends` only when the new standard specializes an existing one.

Example:

```turtle
cs:react.hooks.cleanup a cs:CodeStandard ;
    rdfs:label "Hooks Cleanup"@en ;
    cs:hasCategory cs:react ;
    cs:description "Effects that create subscriptions, timers, or listeners must return cleanup functions." ;
    cs:do [
        cs:description "Return a cleanup function for subscriptions." ;
        cs:language "typescript" ;
        cs:code """
useEffect(() => {
  const subscription = source.subscribe(handler);
  return () => subscription.unsubscribe();
}, [source]);
        """
    ] .
```

## Extending a standard

```turtle
cs:react.component.structure.context a cs:CodeStandard ;
    rdfs:label "Context Folder Structure"@en ;
    cs:extends cs:react.component.structure.folder ;
    cs:hasCategory cs:react ;
    cs:description "Context providers extend the standard component folder structure with provider-specific files." .
```

## Queries

List standards in a category:

```sparql
PREFIX cs: <http://pragma.canonical.com/codestandards#>

SELECT ?standard ?description WHERE {
  ?standard a cs:CodeStandard ;
            cs:hasCategory cs:react ;
            cs:description ?description .
}
```

Find standards by identifier fragment:

```sparql
PREFIX cs: <http://pragma.canonical.com/codestandards#>

SELECT ?standard WHERE {
  ?standard a cs:CodeStandard .
  FILTER(CONTAINS(LCASE(STR(?standard)), "component.props"))
}
```

## Repository layout

```text
code-standards/
├── definitions/
│   ├── CodeStandard.ttl
│   └── shapes.ttl
├── data/
│   ├── code.ttl
│   ├── css.ttl
│   ├── git.ttl
│   ├── icons.ttl
│   ├── lit.ttl
│   ├── packaging.ttl
│   ├── react.ttl
│   ├── rust.ttl
│   ├── storybook.ttl
│   ├── styling.ttl
│   ├── svelte.ttl
│   ├── testing.ttl
│   ├── tsdoc.ttl
│   ├── turtle.ttl
│   ├── ui-blocks.ttl
│   └── webcomponents.ttl
├── docs/
├── skills/
└── src/scripts/generate-docs.ts
```

## Commands

- `bun run docs` — regenerate markdown docs from Turtle data
- `bun run docs:check` — verify generated docs are current
- `bun run check` — run formatting and TypeScript checks

## Links

- [Source](https://github.com/canonical/pragma-core/tree/main/packages/semantics/code-standards)
- [Design System Ontology](https://github.com/canonical/pragma-core/tree/main/packages/semantics/design-system)
- [Pragma Monorepo](https://github.com/canonical/pragma-web)

# Turtle Standards

Standards for turtle development.

## Local name casing convention

**Identifier:** `cs:turtle.naming.local_name_casing`

Within a unified prefix namespace, differentiate between schema elements and instances using casing conventions for the local name (the part after the prefix colon):

- **PascalCase** for classes (e.g., `ds:Component`, `ds:UIElement`)
- **camelCase** for properties (e.g., `ds:name`, `ds:hasProperty`)
- **lowercase** with dot-separated hierarchy and snake_case inside multi-word segments for instances (e.g., `ds:global.component.button`, `cs:turtle.naming.local_name_casing`)

For code standards specifically, the subject IRI is the canonical identifier. Use `rdfs:label` only as a human-readable display title, never as a slug or lookup key.

This convention allows a single prefix to serve both definitions and data, with the casing clearly indicating the type of resource.

### Do

Use PascalCase for class names.
```turtle
ds:Component a owl:Class .
ds:UIBlock a owl:Class .
ds:ModifierFamily a owl:Class .
```

Use camelCase for property names.
```turtle
ds:name a owl:DatatypeProperty .
ds:hasProperty a owl:ObjectProperty .
ds:parentComponent a owl:ObjectProperty .
```

Use lowercase with dots for hierarchy and snake_case for multi-word instance segments.
```turtle
ds:global.component.button a ds:Component .
ds:global.modifier_family.importance a ds:ModifierFamily .
cs:turtle.naming.local_name_casing a cs:CodeStandard ;
    rdfs:label "Local Name Casing Convention"@en .
```

### Don't

Use lowercase for class names.
```turtle
# Bad: Class names should be PascalCase
ds:component a owl:Class .
```

Use PascalCase for instance identifiers.
```turtle
# Bad: Instance names should be lowercase
ds:GlobalComponentButton a ds:Component .
```

Use PascalCase or uppercase for property names.
```turtle
# Bad: Property names should be camelCase
ds:HasProperty a owl:ObjectProperty .
ds:NAME a owl:DatatypeProperty .
```

---

## Unified prefix

**Identifier:** `cs:turtle.naming.unified_prefix`

When a package uses a single namespace for both ontology and data, use a unified prefix with casing to distinguish between classes, properties, and instances. This simplifies prefix management and makes the relationship between schema and data more apparent.

The namespace URI should be a base URI without a fragment or trailing path segment for ontology vs data (e.g., `https://ds.canonical.com/` rather than separate `https://ds.canonical.com/ontology#` and `https://ds.canonical.com/data/`).

### Do

Use a single prefix for both definitions and data.
```turtle
# In both definitions/ and data/ files:
@prefix ds: <https://ds.canonical.com/> .

# Definitions use PascalCase/camelCase
ds:Component a owl:Class .
ds:name a owl:DatatypeProperty .

# Data uses lowercase
ds:global.component.button a ds:Component ;
    ds:name "Button" .
```

### Don't

Use separate prefixes for ontology and data when a unified prefix is preferred.
```turtle
# Bad: Unnecessarily complex when unified prefix suffices
@prefix dso: <https://ds.canonical.com/ontology#> .
@prefix ds: <https://ds.canonical.com/data/> .

ds:global.component.button a dso:Component .
```

---

## Definitions vs data files

**Identifier:** `cs:turtle.structure.definitions_vs_data`

Turtle files must be organized into two directories based on their content:

- `definitions/` contains schema files (ontologies) with classes, properties, and datatypes
- `data/` contains instance files with actual data conforming to the schema

This separation allows tools to distinguish between schema and instance data, enables different validation rules, and makes the codebase easier to navigate.

### Do

Place ontology definitions (classes, properties, datatypes) in the `definitions/` directory.
```turtle
# definitions/ontology.ttl
@prefix ds: <https://ds.canonical.com/> .

ds:Component a owl:Class ;
    rdfs:label "Component" .

ds:name a owl:DatatypeProperty ;
    rdfs:domain ds:UIElement ;
    rdfs:range xsd:string .
```

Place instance data in the `data/` directory.
```turtle
# data/global/component/button.ttl
@prefix ds: <https://ds.canonical.com/> .

ds:global.component.button a ds:Component ;
    ds:name "Button" .
```

### Don't

Mix class definitions and instance data in the same file.
```turtle
# Bad: Mixing schema and data
ds:Component a owl:Class .
ds:global.component.button a ds:Component .
```

Place instance data in the `definitions/` directory.
```
# Bad: Data file in definitions
definitions/
  └── button.ttl  # Contains instance data
```

---

## Prefix declaration

**Identifier:** `cs:turtle.syntax.prefix_declaration`

Every Turtle file must declare all prefixes used within the file at the top of the file. Each prefix should be declared exactly once. Standard prefixes (rdf, rdfs, owl, xsd, skos) should be declared when used but are commonly understood.

### Do

Declare all prefixes at the top of the file.
```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix ds:    <https://ds.canonical.com/> .

ds:Component a owl:Class ;
    rdfs:label "Component" .
```

### Don't

Declare the same prefix multiple times.
```turtle
# Bad: Duplicate prefix declaration
@prefix ds: <https://ds.canonical.com/> .
@prefix ds: <https://ds.canonical.com/> .
```

Use prefixes without declaring them.
```turtle
# Bad: Missing prefix declaration for ds:
ds:Component a owl:Class .
```

---

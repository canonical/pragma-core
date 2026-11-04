# QueryChips

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global/global.group.query_chips.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global.group.query_chips` |
| `rdf:type` | `ds:Group` |
| `ds:name` | QueryChips |
| `ds:tier` | `ds:global` |

A Group is a set of sibling blocks whose collection carries its own identity. QueryChips's
member is `ds:global.component.segmented_chip`, one or more; the ontology has no member
predicate, so the membership is stated here and as the anatomy's one edge.

## ds:summary

QueryChips is the set of clauses that narrow a collection, each shown as one segmented chip.
It lays the chips out in a wrapping row and gives the set one accessible name. It serves the
filters and search of a query bar, the conditions of a saved view and the matchers of a rule.
It holds segmented chips and nothing else.

## ds:usage

### When to use

- Several clauses apply together, and each must stay readable and editable on its own.

### When not to use

- One clause only, read-only: use **Tag**.
- Dismissible values picked from one set, such as the values of a multi-select: use
  **ComboboxInput**'s selected values or **Chip**.
- Applied filters that are only summarised and removed, never edited: **Chip** with a dismiss
  control is enough.

## ds:guidelines

### Accessibility

- The group is a list: a `<ul role="list">` with one `<li>` per chip. The explicit role keeps
  the list's semantics in browsers that drop them from a list without bullets.
- Exactly one of `label` and `aria-labelledby` names the list.
- The container that hosts the group decides the keyboard model and carries its composite role.
  A QueryInput makes its chips and its entry one roving tab stop inside a toolbar. The group
  itself handles no keys.
- The gap between chips is not a target; nothing is inserted between chips.

### Layout

- Chips wrap. A host that must hold one line clips and fades the overflow, and says how many
  chips are hidden.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `label` | text | true | | required unless `aria-labelledby` is given, and not given with it | The accessible name of the set. |
| `children` | node | false | | one or more segmented chips | The segmented chips. |

The remaining props are those of the `<ul>`, apart from `role`, such as `aria-labelledby`.

## ds:hasModifierFamily

None of its own. Its members read **Condition** and **Criticality**; their arrangement is
SegmentedChip's `unity` property.

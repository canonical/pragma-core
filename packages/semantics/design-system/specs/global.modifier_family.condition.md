# Condition

A modifier family, drafted for entry into the database of record. The first table holds the
family's own predicates; the second holds one `ds:Modifier` per value.

| Predicate | Value |
|---|---|
| IRI | `ds:global.modifier_family.condition` |
| `rdf:type` | `ds:ModifierFamily` |
| `ds:name` | Condition |
| `ds:tier` | `ds:global` |
| `ds:hasModifier` | `ds:global.modifier.inclusion`, `ds:global.modifier.exclusion`, `ds:global.modifier.match`, `ds:global.modifier.range`, `ds:global.modifier.presence` |

## ds:summary

Condition names what a clause's operator asserts about a record: that the record's value is one
of the given values, is not, holds the given text, lies within a range, or is present. A
component that shows or summarises a clause takes the value its clause asserts, and the tokens
give each value its treatment, so the treatment can change without changing what the clause
means.

## Values

Each value is a `ds:Modifier` with `ds:modifierFamily ds:global.modifier_family.condition`.

| IRI | `ds:name` | `ds:summary` | Operators |
|---|---|---|---|
| `ds:global.modifier.inclusion` | Inclusion | The record's value is one of the given values. | `is`, `isAny` |
| `ds:global.modifier.exclusion` | Exclusion | The test is negated: the record's value is none of the given values, differs from the given value, does not hold the given text, or is absent. | `isNot`, `isNone`, `notContains`, and `isSet` when false |
| `ds:global.modifier.match` | Match | The record's value holds the given text. | `contains`, `startsWith`, `endsWith` |
| `ds:global.modifier.range` | Range | The record's value lies at or beyond one bound, or between two. | `gte`, `lte`; a range between two bounds is one chip over both |
| `ds:global.modifier.presence` | Presence | The record holds a value for the field. | `isSet` when true |

The table follows the implementing library's one mapping from operator to value, and names
the operators as @canonical/dataviews-core's operator vocabulary does. Four of them, `is`,
`isNot`, `notContains` and `endsWith`, are operators the library is adding for text fields,
and with them `isSet` takes a true or false operand; the rest exist today. Each operator's
spoken words come from that library's messages, not from this table.

Negation is a value, not a second axis. Every negated test maps to Exclusion, so negated tests
share one treatment, and the operator's words still say which test it is. A separate polarity
family crossed with the other four values would double the token positions for one cue that
the words already carry.

## Notes for the entry

These notes are not predicates of a modifier family. They belong in the documentation of the
blocks that take the family.

### When to use

- On the part of a component that shows an operator: the operator segment of a
  **SegmentedChip**, or a **Tag** that summarises a clause.
- As a property value where a component summarises a clause without showing its operator: a
  **FilterButton** takes its applied clause's value and shows Exclusion's mark. It reads no
  Condition tone, so it does not take the family itself.

### When not to use

- For a status or an outcome: use **Criticality**.
- For the weight of an action: use **Importance** or **Anticipation**.

### Accessibility

- Colour never carries the value alone. Exclusion always shows its mark, `≠` or "not", and
  every symbol has a spoken name in the accessible name of the component that shows it.

### Tokens

- A value routes the channels the operator segment reads, as Criticality does:
  `modifier.color.foreground.secondary` and `modifier.color.text.onForegroundSecondary`.
- @canonical/design-tokens needs one position per value, named as its other families' are:
  `coordinate.condition.inclusion`, `coordinate.condition.exclusion`,
  `coordinate.condition.match`, `coordinate.condition.range` and
  `coordinate.condition.presence`, with `coordinate.condition.none`. None exists yet.
- Inclusion, Match, Range and Presence route to `color.foreground.secondary.information` and
  `color.text.onForegroundSecondary.information`.
- Exclusion needs a negation tone of its own, which no symbol declares; that is for the token
  owners to decide. Until they do, it routes to the Information symbols, and its mark carries
  the meaning.

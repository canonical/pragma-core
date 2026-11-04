# Condition

A modifier family, drafted for entry into the database of record. The first table holds the
family's own predicates; the second holds one `ds:Modifier` per value.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.modifier_family.condition` |
| `rdf:type` | `ds:ModifierFamily` |
| `ds:name` | Condition |
| `ds:tier` | `ds:global_dataviews` |
| `ds:hasModifier` | `ds:global_dataviews.modifier.inclusion`, `ds:global_dataviews.modifier.exclusion`, `ds:global_dataviews.modifier.match`, `ds:global_dataviews.modifier.range`, `ds:global_dataviews.modifier.presence` |

## ds:summary

Condition names what a clause's operator asserts about a record: that the record's value is one
of the given values, is not, holds the given text, lies within a range, or is present. A
component that shows or summarises a clause takes the value its clause asserts, and the tokens
give each value its treatment, so the treatment can change without changing what the clause
means.

## Values

Each value is a `ds:Modifier` with `ds:modifierFamily
ds:global_dataviews.modifier_family.condition`.

| IRI | `ds:name` | `ds:summary` | Operators |
|---|---|---|---|
| `ds:global_dataviews.modifier.inclusion` | Inclusion | The record's value is one of the given values. | `is`, `isAny` |
| `ds:global_dataviews.modifier.exclusion` | Exclusion | The test is negated: the record's value is none of the given values, differs from the given value, does not hold the given text, or is absent. | `isNot`, `isNone`, `notContains`, and `isSet` when false |
| `ds:global_dataviews.modifier.match` | Match | The record's value holds the given text. | `contains`, `startsWith`, `endsWith` |
| `ds:global_dataviews.modifier.range` | Range | The record's value lies at or beyond one bound, or between two. | `gte`, `lte`; a range between two bounds is one chip over both |
| `ds:global_dataviews.modifier.presence` | Presence | The record holds a value for the field. | `isSet` when true |

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

- On the part of a component that shows an operator: the operator **QueryChip.Segment** of a
  QueryChip. Every block that takes the family sits in Global/DataViews, the family's tier.
- As a property value where a component summarises a clause without showing its operator: a
  **FilterButton** takes its applied clause's value and shows that value's mark. It reads no
  Condition tone, so it does not take the family itself.

### When not to use

- For a status or an outcome: use **Criticality**.
- For the weight of an action: use **Importance** or **Anticipation**.

### Accessibility

- Colour never carries the value alone. Every value shows its mark, and every mark has a
  spoken name in the accessible name of the component that shows it.

### Marks

Each value has a glyph of its own. How a glyph is bound is not decided yet, and the token graph
declares none, so only colour is bound. The icon set has a glyph for one value only, so the
others are placeholders, each a gap for the icon set.

| Value | Placeholder | Icon set |
|---|---|---|
| Inclusion | `=` | none yet |
| Exclusion | `≠` | none yet |
| Match | `⌕` | `search`, which the query field also uses as its leading icon |
| Range | `↔` | none yet |
| Presence | `●` | none yet |

### Tokens

- Each value has positions of its own for its fill and its text, so a theme can re-point any
  value without a change to any component. A value routes the channels the
  operator Segment reads, as Criticality does: `modifier.color.foreground.secondary` and
  `modifier.color.text.onForegroundSecondary`. No channel routes the icon symbols on a
  secondary fill per value yet, so the mark reads `color.icon.onForegroundSecondary` until one
  exists.
- @canonical/design-tokens needs one position per value, named as its other families' are:
  `coordinate.condition.inclusion`, `coordinate.condition.exclusion`,
  `coordinate.condition.match`, `coordinate.condition.range` and
  `coordinate.condition.presence`, with `coordinate.condition.none`. None exists yet, and the
  token graph does not yet declare a value's glyph.
- Today the positions alias to two tones. Inclusion, Match, Range and Presence alias to the
  Information tone, `color.foreground.secondary.information` and
  `color.text.onForegroundSecondary.information`. Exclusion aliases to a negation tone of its
  own, a fill and text pair beside the Information pair. No symbol declares it yet, so until
  one does, Exclusion reads the Information pair and its mark carries the negation.

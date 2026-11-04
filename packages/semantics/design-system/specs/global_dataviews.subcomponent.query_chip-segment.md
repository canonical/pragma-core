# QueryChip.Segment

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global_dataviews/global_dataviews.subcomponent.query_chip-segment.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.subcomponent.query_chip-segment` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | QueryChip.Segment |
| `ds:tier` | `ds:global_dataviews` |
| `ds:parentComponent` | `ds:global_dataviews.component.query_chip` |
| `ds:standalone` | false |
| `ds:hasModifierFamily` | `ds:global_dataviews.modifier_family.condition` |

## ds:summary

One settled part of a query chip, such as its field, its operator or its value: a piece of
text with its own fill, which can be hovered, chosen or marked invalid without its siblings.
The host composes one Segment for each settled part.

## ds:usage

### When to use

- Inside a QueryChip, for each part that is not being typed.

### When not to use

- For the part being typed or edited: use **QueryChip.Entry**.
- On its own. A lone piece of interactive text is a **Chip**.

## ds:guidelines

### Accessibility

- Once scripts run, and when it has `onActivate`, a Segment is a native button named by its
  text, or by its `label` when one is given. Otherwise, and before scripts run, it is plain
  text; when its `label` differs from its text, the text is `aria-hidden` and the label renders
  beside it as visually hidden text, so a symbol such as `≥` is spoken as "at least".
- A Segment with a `condition` shows that Condition value's mark before its text. The mark is
  hidden from assistive technology, because the `label` speaks the operator.
- Inside a roving composite, the chip's first Segment is the chip's toolbar item and takes
  `tabindex="0"` only while it holds the tab stop; every other Segment button takes
  `tabindex="-1"`, reached by Enter on the chip, then Tab.
- Each Segment button is at least 24 by 24 px, whatever its text, so a one-glyph operator such
  as `≥` is still a full target.
- An invalid Segment carries its state in its accessible description, through
  `aria-describedby` on its `description`, because `aria-invalid` does not apply to a button.
  While it is invalid, the chip's first Segment is described by it too.

### States & interaction

A Segment is default, hovered, selected, invalid or disabled. It is selected when its chip is
selected. Its tone comes from its `condition`, or from the chip's Criticality value, which
tints every Segment; Error also marks the chip refused. Its own `@invalid` state wins over
either. Every transition belongs to the host.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `children` | node | false | | text | The part's text, such as `status` or `≥`. |
| `label` | text | true | | | The spoken text when it differs from the shown text, such as "at least" for `≥`. |
| `condition` | choice | true | | `[inclusion, exclusion, match, range, presence]` | The Condition value, on the operator Segment. |
| `invalid` | boolean | true | false | requires `description` | Marks the part at fault. |
| `description` | text | true | | required with `invalid` | The accessible description, such as "Invalid: <message>", or on the first Segment of a refused chip "Refused: <reason>". |
| `onActivate` | callback | true | | | Called when the Segment is activated. Passing it makes the Segment a button; without it, it is plain text. |

The remaining props are those of the Segment's element, apart from `children`.

## ds:hasModifierFamily

- **Condition**, set through `condition` on the operator Segment. It selects the Segment's tone
  and its mark.

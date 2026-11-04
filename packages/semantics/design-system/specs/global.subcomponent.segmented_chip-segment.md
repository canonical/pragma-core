# SegmentedChip.Segment

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global/global.subcomponent.segmented_chip-segment.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global.subcomponent.segmented_chip-segment` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | SegmentedChip.Segment |
| `ds:tier` | `ds:global` |
| `ds:parentComponent` | `ds:global.component.segmented_chip` |
| `ds:standalone` | false |

## ds:summary

One part of a segmented chip: a piece of text with its own fill, which can be hovered,
selected, edited or marked invalid without its siblings. The chip creates one segment for
each entry of its `segments` property.

## ds:usage

### When to use

- Only inside a SegmentedChip, which creates its segments.

### When not to use

- On its own. A lone piece of interactive text is a **Chip**.

## ds:guidelines

### Accessibility

- Once scripts run, and when its chip has `onSegmentActivate`, a segment that is not being
  edited is a native button named by its own text, or by its `label` when the chip's
  `segments` entry gives one. Otherwise, and before scripts run, it is plain text.
- Inside a roving composite, the segment reads the composite's roving context and takes
  `tabindex="0"` only while it holds the tab stop; neither the chip nor a segment adds a tab
  stop of its own.
- While edited, the segment is no longer a button: it is a plain container holding the host's
  editor, which owns focus and its own ARIA.

### States & interaction

A segment is default, hovered, selected, invalid or disabled. It is selected when its chip is
selected or when it is the segment being edited. Its tone comes from the Condition value on the
operator segment, or from Criticality Error on a refused chip. Its own `@invalid` state wins
over either. Every transition belongs to the host.

## ds:hasProperty

None of its own; the parent creates it from its `segments`.

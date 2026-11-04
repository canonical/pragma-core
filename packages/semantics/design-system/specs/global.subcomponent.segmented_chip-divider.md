# SegmentedChip.Divider

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global/global.subcomponent.segmented_chip-divider.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global.subcomponent.segmented_chip-divider` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | SegmentedChip.Divider |
| `ds:tier` | `ds:global` |
| `ds:parentComponent` | `ds:global.component.segmented_chip` |
| `ds:standalone` | false |

## ds:summary

The separation between two consecutive segments of a segmented chip, and the only one: the
chip's body sets no gap. When the chip's `unity` is `separated`, it is 2 px wide and paints
nothing, so the surface behind the chip shows through; when it is `joined`, it is a 1 px line
with 6 px on each side.

## ds:usage

### When to use

- Between every two segments of a SegmentedChip, placed by the chip.

### When not to use

- Elsewhere. The space between whole chips is their group's gap.

## ds:guidelines

### Accessibility

- It is decorative, hidden from assistive technology with `aria-hidden`, and never a target.

## ds:hasProperty

None.

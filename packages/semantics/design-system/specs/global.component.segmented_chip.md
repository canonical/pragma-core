# SegmentedChip

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global/global.component.segmented_chip.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global.component.segmented_chip` |
| `rdf:type` | `ds:Component` |
| `ds:name` | SegmentedChip |
| `ds:tier` | `ds:global` |
| `ds:hasSubcomponent` | `ds:global.subcomponent.segmented_chip-segment`, `ds:global.subcomponent.segmented_chip-divider` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.condition`, `ds:global.modifier_family.criticality` |

## ds:summary

A segmented chip shows one structured value as a row of segments that are read together and
edited one at a time, such as a field, an operator and a value. Unlike **Chip**, whose value is
one piece of text and whose action is filtering or dismissal, each segment of a segmented chip
can be selected and edited on its own. It serves the clauses of a query bar, the conditions of
a saved view and the matchers of a rule. It knows nothing about queries: its host gives it text
and hears which segment was activated.

## ds:usage

### When to use

- One clause has parts that a person changes independently: `status · is any of · deployed, ready`.
- The parts need different emphasis, such as an operator in its own tone.

### When not to use

- A single value: use **Chip**.
- A read-only label: use **Tag**.
- A free choice among options: use **ComboboxInput** or **SelectInput**.

## ds:guidelines

### Accessibility

- The chip is a row of two parts: its body, which holds the segments, and, beside it, an
  optional remove control. Neither the chip nor its body is a button, so no interactive content
  is ever nested inside one.
- Once scripts run, and only when the host passes `onSegmentActivate`, each segment that is not
  being edited is a native button named by its own text, or its `label`, and the body carries
  `role="group"`, named by the whole clause with each symbol spoken by its segment's `label`,
  which the host takes from its messages. Segment buttons exist only inside a roving context:
  a host that passes `onSegmentActivate` hosts the chip in one, such as QueryInput's toolbar.
  Without `onSegmentActivate` the chip is read-only: its segments are plain text, and its one
  tab stop is its remove control. Before scripts run, the segments are plain text.
- While a segment is edited, it is no longer a button: it is a plain container holding the
  host's editor, which owns focus and its own ARIA.
- The chip is selected while focus is within its body and no segment is edited; it has no
  `selected` property, so the selected fill never shows without focus. The body then shows one
  focus ring around the clause, and the selected fill is an additional cue. Segments draw no
  ring of their own: inside the roving context, focus rests on the chip's first segment, or on
  the edited segment, whose editor shows it.
- The ring is 3 px of `color.focusRing`, 2 px outside the body, so it is drawn against the
  surface beneath the chip rather than the selected fill. It meets 3:1 in both modes: 4.96:1
  on `color.background`, and 4.67:1 in light mode and 5.47:1 in dark mode on
  `color.foreground.input`. An inset ring on `color.foreground.secondary.active` would give
  3.04:1 and 2.95:1, below 3:1 in dark mode. The body sits 8 px from the remove control, so
  the ring never draws over it.
- The chip is at least 24 px tall. The remove control is a native button, or a link when
  `removeHref` is given, of at least 24 by 24 px, named by `removeLabel`, such as "Remove
  status is deployed", which the host takes from its messages. It sits outside the body's
  clipping, so its own focus ring shows whole. On a refused read-only chip it also takes
  `aria-describedby` pointing at the refused segment's `description`, because no segment
  there takes focus.
- Inside a roving composite, such as QueryInput's toolbar, the chip reads the composite's roving
  context: the id of the item that holds the tab stop, and a setter. Item ids are unique across
  the toolbar: each segment registers as `<chip id>:<segment id>`, so the chip's `id` is
  required there. The segment that holds the stop takes `tabindex="0"` and every other segment
  `tabindex="-1"`, and a segment is focused when the context moves the stop onto it. The remove
  control takes `tabindex="-1"` there: it stays reachable by pointer, and Delete or Backspace on
  the selected chip is its keyboard path. A read-only chip has no segment buttons, so its
  remove control is its roving item, as `<chip id>:remove`, and takes `tabindex="0"` while it
  holds the stop. Outside a roving context the chip is read-only, and its remove control is in
  the tab order.
- Each segment button is at least 24 by 24 px, whatever its text, so a one-glyph operator such
  as `≥` is still a full target.
- `aria-invalid` does not apply to a button, so an invalid or refused segment carries its
  state in its accessible description instead: the segment's `description`, such as "Invalid:
  <message>" or "Refused: <reason>", which it references through `aria-describedby`. While the
  faulty segment is edited, the editor carries `aria-invalid`. The segment named by
  `invalidSegment` must have a `description`. A refused chip's reason is the
  `description` of its first segment, which shows the glyph and takes focus when focus moves
  onto the chip.
- The chip sets the selected fill through a data attribute, never `aria-selected`, which
  neither a button nor a group supports. Selection reaches assistive technology through focus.

### Without scripts

Before scripts run, the segments are plain text. The remove control is a link to `removeHref`
only when the host can spell addresses and passes one; otherwise, as under an in-memory query
state, the server renders the control inert, and it works once scripts run.

### States & interaction

The chip has several interacting modes, so its states are specified here.

| State | Entered by | Shown as |
|---|---|---|
| default | | segment fills from `color.foreground.secondary` |
| hover | the pointer over a segment | that segment's hover step |
| selected | focus within the body while no segment is edited | every segment takes the active step, with the focus ring |
| editing | the host opens one segment | that segment takes the active step and shows the host's editor |
| invalid | the host names the segment at fault | that segment takes the error fill and text, and the error glyph, which is Criticality Error's own |
| refused | the host sets Criticality Error on the chip | every segment takes the error tone through the modifier channels, and the first segment shows the error glyph |
| disabled | the host disables the chip | disabled fills and text; it takes no focus |

- The initial state is default.
- The table describes the default `unity`, `separated`. When it is `joined`, the chip's body
  shows hover, selected and invalid in place of its segments.
- Every transition is the host's. The chip calls `onSegmentActivate` with a segment's id when
  that segment's button is activated, by a click, Enter or Space, and `onRemove` from its remove
  control.
- The host owns the arrow keys, Tab and Delete, and moves the roving tab stop across segments
  and chips through its roving context. Moving onto a chip lands on its first segment, so Enter
  there edits from the first segment.
- When a chip is removed, the host moves focus and the tab stop to the next chip's first
  segment, or to the previous chip's when none follows, or to its entry when no chip remains.
- Invalid and refused differ. Invalid is an edit at fault on one segment, bound to the
  segment's `@invalid` state, which wins over any tone the channels give. Refused is a clause
  the source refused as a whole: the host sets Criticality Error on the chip and sets no
  `condition` on its segments, so the channels give every segment the error tone. Hover and
  selected bind the plain steps, which replace a channel's tone, so a hovered or selected
  segment of a refused chip loses its error fill; the glyph remains the refused cue.
- `editor` is ignored unless `editingSegment` names a segment. A segment named by
  `editingSegment` with no `editor` keeps its text.

### Unity

`unity` says how the segments hold together, and its values are named for what each is for,
not for how it looks.

- `separated`, the default, is for a clause whose parts people change one at a time, as in a
  query being built. Each segment carries its own fill and is its own hover, selection and
  error target.
- `joined` is for a clause people mostly read as a whole, as in the applied criteria of a saved
  view shown in summary. One container carries the fill and is the hover, selection and error
  target; its segments show only an inner highlight and the operator's tone.

Under both, each segment stays its own button and the keyboard model is the same.

- A flat form, with square corners and plain text, is not a value: it differs from `separated`
  only in how it looks, so it is `separated` with its component tokens remapped by a theme or
  an application.
- `unity` is a property, not a modifier family, so it does not cascade. The modifier families a
  segmented chip reads carry the clause's meaning only.

| Slot | `separated` | `joined` |
|---|---|---|
| Body background | `transparent` | `color.foreground.secondary` |
| Body border | none | `dimension.stroke.thickness.medium`; no symbol declares its colour, #c5c5c5 in the reference design |
| Body radius | `dimension.radius.full`, clipping the segment ends | `dimension.radius.full` |
| Body minimum height | `dimension.300` | 26 px, which no symbol declares |
| Body inline padding | 0 | `dimension.100` |
| Body states | none | hover, selected and invalid take `color.foreground.secondary.hover`, `.active` and `.error`; invalid also takes `color.border.error` |
| Segment background | `color.foreground.secondary`, with its hover, active, disabled and error steps | `transparent`, unless a Condition or Criticality value paints it |
| Segment inner highlight | none | no symbol yet |
| Segment text | `color.text.onForegroundSecondary` | `color.text.onForegroundSecondary` |
| Segment inline padding | 6 px, which no symbol declares | 0 |
| Divider | `dimension.025` wide, painted transparent | `dimension.stroke.thickness.medium` wide and `dimension.300` tall, with 6 px on each side; no symbol declares its colour or margin |
| Operator tone, from **Condition** | the segment's fill and text | a patch behind the operator's label only, through the same channels |

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `id` | text | true | | unique among the chips of a roving context, and required inside one | The chip's id, which prefixes its segments' roving item ids. |
| `segments` | list of objects | false | | at least one; each `{ id, text, label?, condition?, description? }`; the segment named by `invalidSegment` has a `description` | The segments, in order. Each has an `id`, its `text`, the spoken `label` when it differs from the text, on the operator segment its `condition`, and its accessible `description`, such as "Invalid: <message>" or "Refused: <reason>"; a refused chip's reason is its first segment's. |
| `editingSegment` | text | true | | the id of one segment | The id of the segment being edited. |
| `editor` | node | true | | read only while `editingSegment` is set | What the edited segment shows in place of its text. |
| `invalidSegment` | text | true | | the id of one segment, which must have a `description` | The id of the segment at fault, which marks the chip invalid. |
| `unity` | choice | true | `separated` | `[separated, joined]` | How the segments hold together: `separated` makes each segment its own target, `joined` makes the chip one target. See "Unity". |
| `disabled` | boolean | true | false | | Disables the chip. |
| `onSegmentActivate` | callback | true | | | Called with a segment's id when that segment's button is activated. Passing it makes the segments buttons; without it the chip is read-only. |
| `onRemove` | callback | true | | | Called by the remove control. Passing it, or `removeHref`, shows the control. |
| `removeHref` | url | true | | | Makes the remove control a link to this address, so that removal works before scripts run; a click still calls `onRemove` when it is given. Passing it, or `onRemove`, shows the control. |
| `removeLabel` | text | true | | required with `onRemove` or `removeHref` | The remove control's accessible name, such as "Remove status is deployed". |

The remaining props are those of the root element, apart from `children`.

A segment's `condition` takes one of `[inclusion, exclusion, match, range, presence]`.

## ds:hasModifierFamily

- **Condition**, on the operator segment, set through its `condition` value.
- **Criticality**, on the chip, for a refused clause: Criticality Error selects the error
  colours and the glyph. A refused chip's segments carry no `condition`, so nothing nearer
  overrides it.

Both reach the segments through `modifier.color.foreground.secondary` and
`modifier.color.text.onForegroundSecondary`. The arrangement is the `unity` property, not a
family.

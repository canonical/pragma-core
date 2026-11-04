# QueryChip

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global_dataviews/global_dataviews.component.query_chip.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.component.query_chip` |
| `rdf:type` | `ds:Component` |
| `ds:name` | QueryChip |
| `ds:tier` | `ds:global_dataviews` |
| `ds:hasSubcomponent` | `ds:global_dataviews.subcomponent.query_chip-segment`, `ds:global_dataviews.subcomponent.query_chip-entry` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.criticality` |

## ds:summary

A query chip shows one clause as a row of parts that are read together and changed one at a
time, such as a field, an operator and a value. Its parts are its children: a
**QueryChip.Segment** for each settled part, and at most one **QueryChip.Entry** for the part
being typed. Unlike **Chip**, whose value is one piece of text and whose action is filtering or
dismissal, each part of a query chip can be chosen and changed on its own. It serves the
clauses of a query bar, the conditions of a saved view and the matchers of a rule. It knows
nothing about queries: its host composes the parts and hears which one was activated.

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

- The chip is a row of two parts: its body, which holds its children, and, beside it, an
  optional remove control. Neither the chip nor its body is a button, so no interactive content
  is ever nested inside one.
- Once scripts run, and while the chip holds a Segment with `onActivate` or an Entry, the body
  carries `role="group"`, named by `label`: the whole clause, with each symbol spoken, such as
  "status is any of deployed, ready", which the host takes from its messages. Such a chip
  lives only inside a roving context, such as QueryInput's toolbar. A chip whose Segments have
  no `onActivate` and which holds no Entry is read-only: its parts are plain text, and its one
  tab stop is its remove control. Before scripts run, every part is plain text.
- The body shows one focus ring around the clause while focus is within it, including when its
  Entry has focus. The chip is selected while focus is within its body and it holds no Entry;
  it has no `selected` property, so the selected fill never shows without focus, and the fill
  is an additional cue to the ring. Parts draw no ring of their own.
- The ring is 3 px of `color.focusRing`, 2 px outside the body, so it is drawn against the
  surface beneath the chip rather than the selected fill. It meets 3:1 in both modes: 4.93:1
  (light) and 5.00:1 (dark) on `color.background`, and 4.64:1 in light mode and 5.52:1 in dark
  mode on `color.foreground.input`. An inset ring on `color.foreground.secondary.active` would
  give 3.33:1 and 2.97:1, below 3:1 in dark mode. The body sits 8 px from the remove control,
  and a host keeps neighbouring chips and its entry 8 px apart too, so no ring draws over a
  neighbour.
- The chip is at least 24 px tall. The remove control is a native button, or a link when
  `removeHref` is given, of at least 24 by 24 px, named by `removeLabel`, such as "Remove
  status is deployed", which the host takes from its messages. It sits outside the body's
  clipping, so its own focus ring shows whole. On a refused read-only chip it also takes
  `aria-describedby` pointing at the first Segment's `description`, because no part there
  takes focus.
- Inside a roving composite, such as QueryInput's toolbar, the chip reads the composite's
  roving context: the id of the item that holds the tab stop, and a setter. The chip is one
  toolbar item: its first Segment, registered as `<id>`, or its Entry while it holds one,
  registered as `<id>:entry`, so the chip's `id` is required there. That item takes
  `tabindex="0"` while it holds the stop and is focused when the context moves the stop onto
  it. The chip's other Segment buttons always take `tabindex="-1"`: their keyboard path is
  Enter on the chip, then Tab, and they stay reachable by pointer. The remove control takes
  `tabindex="-1"` there: it stays reachable by pointer, and Delete or Backspace on the selected
  chip is its keyboard path. A read-only chip has no interactive parts, so its remove control
  is its roving item, as `<id>:remove`, and takes `tabindex="0"` while it holds the stop.
  Outside a roving context the chip is read-only, and its remove control is in the tab order.
- An invalid part carries its state in its accessible description: its `description`, such as
  "Invalid: <message>", through `aria-describedby`. While a part is invalid, the chip's first
  Segment is also described by that `description`, because focus lands there first. A refused
  chip's reason is the `description` of its first Segment, which shows the glyph and takes
  focus when focus moves onto the chip.
- The chip sets the selected fill through a data attribute, never `aria-selected`, which
  neither a button nor a group supports. Selection reaches assistive technology through focus.

### Without scripts

Before scripts run, every part is plain text, and an Entry is not rendered. The remove control
is a link to `removeHref` only when the host can spell addresses and passes one; otherwise, as
under an in-memory query state, the server renders the control inert, and it works once
scripts run.

### States & interaction

The chip has several interacting modes, so its states are specified here.

| State | Entered by | Shown as |
|---|---|---|
| default | | Segment fills from `color.foreground.secondary` |
| hover | the pointer over a Segment button | that Segment's hover step; a plain-text Segment shows none |
| selected | focus within the body while it holds no Entry | every Segment takes the active step, with the focus ring |
| invalid | a part with `invalid` | that part takes the error fill and text, and the error glyph, which is Criticality Error's own |
| refused | the chip's Criticality value is `error` | every Segment takes the error tone through the modifier channels, the first Segment shows Error's glyph, and its `description` gives the reason |
| disabled | `disabled` | disabled fills and text; it takes no focus |

- The initial state is default. An Entry draws its own look, so the chip has no editing state.
- The table describes the default `unity`, `separated`. When it is `joined`, hover and invalid
  show on every part at once, because the chip is one target; selected shows on every part
  under both values.
- Every transition is the host's. A Segment calls its `onActivate` when its button is
  activated, by a click, Enter or Space, and the remove control calls `onRemove`.
- The host owns the arrow keys, Tab and Delete, and moves the roving tab stop across parts and
  chips through its roving context. Moving onto a chip lands on its first Segment.
- When a chip is removed, the host moves focus and the tab stop to the next chip's first
  Segment, or to the previous chip's when none follows, or to its entry when no chip remains.
- Invalid and refused differ. Invalid is a part at fault, bound to that part's `@invalid`
  state, which wins over any tone the channels give. Refused is a clause the source refused as
  a whole: the host sets the chip's Criticality value to `error` and sets no `condition` on its
  Segments, so the channels give every Segment the error tone. Hover and selected bind the
  plain steps, which replace a channel's tone, so a hovered or selected Segment of a refused
  chip loses its error fill; the glyph remains the refused cue.
- Every Criticality value tints the chip through the modifier channels, as the family requires
  of a consumer; only `error` carries behaviour: it marks the clause refused, puts Error's glyph
  on the first Segment, and links the reason from that Segment's `description`.

### Composition

Building a clause and editing one are the same mechanism, which the host composes.

- Once a field is chosen, the host renders a draft chip: a Segment for the field, followed by
  an Entry. The Entry moves right as the operator and then the value are chosen, each settled
  part becoming a Segment.
- Editing a part swaps its Segment for an Entry, and committing swaps it back.
- A chip holds at most one Entry. QueryInput gives that Entry its suggestions through its
  context.

### Unity

`unity` says how the parts hold together, and its values are named for what each is for, not
for how it looks.

- `separated`, the default, is for a clause whose parts people change one at a time, as in a
  query being built. Each Segment carries its own fill and is its own hover and error target;
  selection is the chip's. The body sets a 2 px gap, `dimension.025`, and paints nothing, so
  the surface beneath the chip shows through between parts.
- `joined` is for a clause people mostly read as a whole, as in the applied criteria of a saved
  view shown in summary. The chip is one hover and error target. The body's fill is
  the line colour, and it sets a 1 px gap, `dimension.stroke.thickness.medium`, so a line shows
  between parts; each Segment's padding gives 6 px on each side of the line.

`unity` changes neither the elements nor the keyboard model: under both, a Segment is a button
only once scripts run and it has `onActivate`.

- A flat form, with square corners and plain text, is not a value: it differs from `separated`
  only in how it looks, so it is `separated` with its component tokens remapped by a theme or
  an application.
- `unity` is a property, not a modifier family, so it does not cascade. The modifier families a
  query chip reads carry the clause's meaning only.

| Slot | `separated` | `joined` |
|---|---|---|
| Body background | `transparent` | the line colour; no symbol declares it, #c5c5c5 in the reference design |
| Body gap | `dimension.025` | `dimension.stroke.thickness.medium` |
| Body border | none | `dimension.stroke.thickness.medium`, in the line colour |
| Body radius | `dimension.radius.full`, clipping the part ends | `dimension.radius.full`, clipping the part ends |
| Body minimum height | `dimension.300` | 26 px, which no symbol declares |
| Segment background | `color.foreground.secondary`, with its hover, active, disabled and error steps | the same; hover, selected and invalid show on every part at once |
| Segment text | `color.text.onForegroundSecondary` | `color.text.onForegroundSecondary` |
| Segment inline padding | 6 px, which no symbol declares | 6 px |
| Operator tone, from **Condition** | the Segment's fill and text | the same |

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `children` | node | false | | one or more QueryChip.Segment, and at most one QueryChip.Entry; while any part is interactive, the first Segment has `onActivate` | The chip's parts, in order. |
| `label` | text | true | | required while a part is interactive | The whole clause as it is spoken, such as "status is any of deployed, ready", which names the body's group. |
| `id` | text | true | | unique among the chips of a roving context, and required inside one | The chip's id, which also names its toolbar item: `<id>`, `<id>:entry`, or `<id>:remove` on a read-only chip. |
| `unity` | choice | true | `separated` | `[separated, joined]` | How the parts hold together: `separated` makes each Segment its own target, `joined` makes the chip one target. See "Unity". |
| `disabled` | boolean | true | false | | Disables the chip. |
| `onRemove` | callback | true | | | Called by the remove control. Passing it, or `removeHref`, shows the control. |
| `removeHref` | url | true | | | Makes the remove control a link to this address, so that removal works before scripts run; a click still calls `onRemove` when it is given. Passing it, or `onRemove`, shows the control. |
| `removeLabel` | text | true | | required with `onRemove` or `removeHref` | The remove control's accessible name, such as "Remove status is deployed". |

The remaining props are those of the root element, apart from `children`.

## ds:hasModifierFamily

- **Condition** is declared on QueryChip.Segment, not on the chip: the operator Segment takes
  the clause's value as its `condition`, which selects that Segment's tone and its mark.
- **Criticality**, on the chip. Every value tints the chip; Error also marks a refused clause,
  and the first Segment shows Error's glyph. A refused chip's Segments carry no `condition`, so
  nothing nearer overrides it.

Both reach the Segments through `modifier.color.foreground.secondary` and
`modifier.color.text.onForegroundSecondary`. The arrangement is the `unity` property, not a
family.

The chip does not take **Surface** yet. Its neutral, information and error fills are to follow
the layer that holds the chip, the page, a panel or a modal, once @canonical/design-tokens gives
them Surface positions. Until then they keep the shades bound here on every layer.

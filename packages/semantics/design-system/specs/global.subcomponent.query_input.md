# QueryInput

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global/global.subcomponent.query_input.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global.subcomponent.query_input` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | QueryInput |
| `ds:tier` | `ds:global` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.density`, `ds:global.modifier_family.surface` |

It composes `ds:global.group.query_chips`, `ds:global.component.icon`,
`ds:global.component.button` and `ds:global.subcomponent.spinner`.

## ds:summary

The field a host places where people type text beside a set of structured values: a leading
search icon, a QueryChips group, the typed-text entry, a clear control and a list of
suggestions. Unlike **SearchInput**, which takes one piece of text, it holds chips beside the
text. Unlike **ComboboxInput**, whose chosen values are tokens taken from one option set, its
chips are clauses its host builds. It knows nothing about queries: its host gives it the chips,
the text and the suggestions, and hears what is typed and chosen.

## ds:usage

### When to use

- Inside a block that builds clauses from typed text, such as **QueryBar**, which supplies the
  fields, the operators and the values.

### When not to use

- Free text only: use **SearchInput**.
- A choice from one option set: use **ComboboxInput**.
- On its own in an application: compose it in a block that owns what the chips and the
  suggestions mean.

## ds:guidelines

### Accessibility

- The entry is a native `<input>`, never a `<textarea>`, which admits no combobox role. A long
  value scrolls inside the input rather than wrapping.
- Once scripts run, the entry takes `role="combobox"` and controls the suggestions, a
  `listbox` of `option`s, through `aria-controls`, `aria-expanded` and
  `aria-activedescendant`. The entry keeps focus while an option is highlighted.
- Once scripts run, the chips' segments and the entry are the items of one element with
  `role="toolbar"`, named by `label` and described by `description`; neither the role nor the
  description renders before scripts run. Exactly one item is in the tab order at a time.
  QueryInput is the roving host. The item that holds the stop is `activeItem`, which the host
  may control with `onActiveItemChange`; QueryInput keeps it itself when both are left out. A
  roving context passes the item and its setter down to the chips' segments and the entry,
  which read it to set their own `tabindex`. Item ids are unique across the toolbar: a segment
  is `<chip id>:<segment id>`, a read-only chip's remove control `<chip id>:remove`, and the
  entry `entry`. The chips' list keeps `role="list"` inside it. Each chip's remove control
  takes `tabindex="-1"` there, unless the chip is read-only and the control is its roving item:
  it stays reachable by pointer, and Delete or Backspace on the selected chip is its keyboard
  path.
- There is one entry. While a segment is edited, the host places it in that segment's editor
  slot, reading it through QueryInput's context, so the one combobox element moves rather than
  a second one appearing, and no input ever sits inside a button. The move keeps focus and the
  caret: it uses `Element.moveBefore()` where the platform has it, and otherwise restores focus
  and the selection synchronously. Blur ends an edit only when focus leaves QueryInput's root,
  a `focusout` whose `relatedTarget` is outside it, never when the entry is moved.
- The field is not focusable itself. While focus is within it, it shows a 3 px inset ring
  (`color.focusRing`) and a highlighted underline. The ring lies on the input fill: 4.67:1 in
  light mode and 5.47:1 in dark mode.
- The clear button is named by `clearLabel`, which the host takes from its messages, and is at
  least 24 by 24 px. It is a native button, or a link when `clearHref` is given.
- A disabled option, and the option marked `current`, carry `aria-disabled` and are never
  `aria-selected`, which the combobox keeps for the highlighted option. Group dividers are
  presentational. An option's hint, such as a count, is part of its accessible name, and its
  `name`, when given, replaces its label in it.
- Loading and an empty list are each announced once, through a visually hidden polite
  `role="status"` region that is always rendered in QueryInput's root, outside the popover,
  and whose text changes when loading or the empty state begins. The visible spinner and empty
  text sit beside the listbox, which holds only options, and are `aria-hidden`.
- A format template is hidden from assistive technology. The host gives the entry its
  accessible description through the remaining props, `aria-describedby` or
  `aria-description`, with resolved text such as "Date, format YYYY-MM-DD".
- Typing is never blocked by key filtering, so paste, dictation and input methods work. The host
  parses what was typed.

### Without scripts

QueryInput renders a working baseline only when its host passes a `name` for the entry, which
a host passes only when it can spell addresses. Then QueryInput is a plain text input in its
host's GET form: the entry is an `<input type="search">` with no combobox role, no toolbar
role and no suggestions, and the chips render as their own baseline. `clearHref` controls only
the clear button, which is then a link to it. Without a `name`, as under an in-memory query
state, the server renders the field inert, and it works once scripts run.

### States & interaction

QueryInput is default, hovered, focused within, invalid or disabled. Its suggestions are
closed or open; while open they are loading, loaded or empty, and one option may be
highlighted. They open while the entry has focus and there is something to show: options, a
loading state or the empty text. They are anchored to the entry, wherever it sits, flip
above it when there is no room below, and stay inside the viewport. Keys other than those the
combobox handles reach the host, which owns chip navigation. Every other transition is the
host's.

### Composition

The suggestions belong to QueryInput, not to its host. The combobox ties the entry to its
listbox: `aria-controls` and `aria-activedescendant` name the listbox and its options by id,
and one state machine opens the list, highlights an option and chooses it. QueryInput owns the
entry and its combobox ARIA, so it owns the listbox too, as **ComboboxInput** owns its results
list. Its host decides only what the options are: their labels, hints and groups, and which
are disabled. A query bar offers fields, operators and values through them.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `label` | text | false | | | The accessible name of the entry and of the toolbar. |
| `description` | text | true | | | The toolbar's accessible description: the keys its host handles. |
| `children` | node | true | | one QueryChips group | The chips, shown before the entry. |
| `value` | text | false | | | The typed text. |
| `onValueChange` | callback | false | | | Called with the typed text after each input. |
| `placeholder` | text | true | | | Shown while nothing is typed and no chip is held. |
| `template` | text | true | | | A format template shown behind the typed text, such as `YYYY-MM-DD`. |
| `suffix` | text | true | | | Text after the typed text, such as a unit, as TextInput's `suffix` is. |
| `options` | list of objects | true | none | each `{ id, label, name?, hint?, disabled?, current?, group? }` | The suggestions, in order. `name` is the spoken name when it differs from the label; `current` marks the option already held, shown bold and not selectable; consecutive options with different `group` values are divided by a line. |
| `onOptionSelect` | callback | true | | | Called with an option's id when it is chosen. |
| `loading` | boolean | true | false | | Shows the spinner in the suggestions. |
| `emptyText` | text | true | | | Shown in the suggestions when there are no options. |
| `footer` | text | true | | | A hint at the foot of the suggestions, such as "Separate multiple values with commas". |
| `invalid` | boolean | true | false | | Marks the field invalid. The entry carries `aria-invalid`. |
| `disabled` | boolean | true | false | | Disables the field. |
| `onClear` | callback | true | | | Called by the clear button. Passing it, or `clearHref`, shows the button. |
| `clearHref` | url | true | | | Makes the clear button a link to this address, so that clearing works before scripts run; a click still calls `onClear` when it is given. Passing it, or `onClear`, shows the button. |
| `clearLabel` | text | true | | required with `onClear` or `clearHref` | The clear button's accessible name, such as "Clear filters and search". |
| `activeItem` | text | true | | a roving item id | The item that holds the toolbar's tab stop. Left out, QueryInput keeps it itself. |
| `onActiveItemChange` | callback | true | | | Called with the item id when the tab stop moves, by a key, a click or a removal. |

The remaining props reach the entry, such as its `name`, so that it submits with a form before
scripts run.

## ds:hasModifierFamily

- **Density**, from the scope.
- **Surface**, set on its suggestions list to the layer one above its host's (Surface2 on a page
  at Surface1), so that list's surface channels resolve to that layer. The option hover binds
  the layer2 ghost step until a surface-routed hover channel exists.


# QueryInput

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global_dataviews/global_dataviews.subcomponent.query_input.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.subcomponent.query_input` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | QueryInput |
| `ds:tier` | `ds:global_dataviews` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.density`, `ds:global.modifier_family.surface` |

It composes `ds:global_dataviews.group.query_chips`, `ds:global.component.icon`,
`ds:global.component.button` and `ds:global.subcomponent.spinner`.

## ds:summary

The field a host places where people type text beside a set of structured values: a leading
search icon, a QueryChips group, the free-text entry, a clear control and a list of
suggestions. The free-text entry takes search text and the first field of a clause; a chip's
own **QueryChip.Entry** takes the rest. Unlike **SearchInput**, which takes one piece of text,
it holds chips beside the text. Unlike **ComboboxInput**, whose chosen values are tokens taken
from one option set, its chips are clauses its host builds. It knows nothing about queries: its
host gives it the chips, the text and the suggestions, and hears what is typed and chosen.

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
  `aria-activedescendant`. The entry keeps focus while an option is highlighted. QueryInput
  gives the same suggestions to a chip's Entry through its context: whichever entry has focus
  carries `aria-controls`, and its `aria-expanded` reflects whether the suggestions are open;
  the other entry carries `aria-expanded="false"`.
- Once scripts run, the chips and the entry are the items of one element with `role="toolbar"`,
  named by `label` and described by `description`; neither the role nor the description renders
  before scripts run. Exactly one item is in the tab order at a time. QueryInput is the roving
  host. The item that holds the stop is `activeItem`, which the host may control with
  `onActiveItemChange`; QueryInput keeps it itself when both are left out. A roving context
  passes the item and its setter down to the chips and the entry, which read it to set their
  own `tabindex`. Each chip is one item. Item ids are unique across the toolbar: a chip is
  `<id>` on its first Segment, or `<id>:entry` while it holds an Entry, a read-only chip's
  remove control is `<id>:remove`, and the free-text entry is `entry`. The chips' list keeps
  `role="list"` inside it. Each chip's remove control takes `tabindex="-1"` there, unless the
  chip is read-only and the control is its roving item: it stays reachable by pointer, and
  Delete or Backspace on the selected chip is its keyboard path. When a host hides the chips,
  it sets `activeItem` to `entry`, and moves focus to the entry if focus was within a chip.
- A chip's Entry is a part of that chip, never inside a Segment's button, so no input ever
  sits inside a button. Blur ends an edit only when focus leaves QueryInput's root, a
  `focusout` whose `relatedTarget` is outside it, never when focus moves between the entries.
- The field is not focusable itself. While focus is within it, it shows a 3 px inset ring
  (`color.focusRing`) and a highlighted underline. The ring lies on the input fill: 4.64:1 in
  light mode and 5.52:1 in dark mode.
- The clear button is named by `clearLabel`, which the host takes from its messages, and is at
  least 24 by 24 px. It is a native button, or a link when `clearHref` is given.
- A disabled option, and the option marked `current`, carry `aria-disabled` and are never
  `aria-selected`, which the combobox keeps for the highlighted option. Group dividers are
  presentational. An option's hint, such as a count, is part of its accessible name, after a
  visually hidden comma and space, as in "deployed, 12 machines", and its `name`, when given,
  replaces its label in it.
- Loading and an empty list are each announced once, through a visually hidden polite
  `role="status"` region that is always rendered in QueryInput's root, outside the popover, and
  whose text changes when loading or the empty state begins: `loadingLabel` while loading, and
  `emptyText` for an empty list. The visible spinner and empty text sit beside the listbox,
  which holds only options, and are `aria-hidden`.
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

QueryInput is default, hovered, focused within or disabled. Unfocused, it holds one line, fades
the chips that overflow it, and shows `hiddenLabel`, such as "+3 more", for the chips it hides;
focused, it wraps and overlays what follows it. Its suggestions are closed or open; while open
they are loading, loaded or empty, and one option may be highlighted. They open while an entry
has focus and there is something to show: options, a loading state or the empty text. They are
anchored to the entry that has focus, wherever it sits, flip above it when there is no room
below, and stay inside the viewport. Keys other than those the combobox handles reach the host,
which owns chip navigation. Every other transition is the host's.

### Composition

The suggestions belong to QueryInput, not to its host. The combobox ties the entry to its
listbox: `aria-controls` and `aria-activedescendant` name the listbox and its options by id,
and one state machine opens the list, highlights an option and chooses it. QueryInput owns the
free-text entry and its combobox ARIA, so it owns the listbox too, as **ComboboxInput** owns
its results list, and lends it to a chip's Entry through its context. Its host decides only
what the options are: their labels, hints and groups, and which are disabled. A query bar
offers fields, operators and values through them.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `label` | text | false | | | The accessible name of the entry and of the toolbar. |
| `description` | text | true | | | The toolbar's accessible description: the keys its host handles. |
| `children` | node | true | | one QueryChips group | The chips, shown before the entry. |
| `value` | text | false | | | The typed text. |
| `onValueChange` | callback | false | | | Called with the typed text after each input. |
| `placeholder` | text | true | | | Shown while nothing is typed and no chip is held. |
| `options` | list of objects | true | none | each `{ id, label, name?, hint?, disabled?, current?, group? }` | The suggestions, in order. `name` is the spoken name when it differs from the label; `current` marks the option already held, shown bold and not selectable; consecutive options with different `group` values are divided by a line. |
| `onOptionSelect` | callback | true | | | Called with an option's id when it is chosen. |
| `loading` | boolean | true | false | | Shows the spinner in the suggestions. |
| `loadingLabel` | text | true | | required while `loading` is true | The words the status region announces while the suggestions load, such as "Loading suggestions", from the host's messages. |
| `emptyText` | text | true | | | Shown in the suggestions when there are no options. |
| `footer` | text | true | | | A hint at the foot of the suggestions, such as "Separate multiple values with commas". |
| `disabled` | boolean | true | false | | Disables the field. |
| `onClear` | callback | true | | | Called by the clear button. Passing it, or `clearHref`, shows the button. |
| `clearHref` | url | true | | | Makes the clear button a link to this address, so that clearing works before scripts run; a click still calls `onClear` when it is given. Passing it, or `onClear`, shows the button. |
| `clearLabel` | text | true | | required with `onClear` or `clearHref` | The clear button's accessible name, such as "Clear filters and search". |
| `activeItem` | text | true | | a roving item id | The item that holds the toolbar's tab stop. Left out, QueryInput keeps it itself. |
| `hiddenLabel` | text | true | | required while chips are hidden | The words for the chips the unfocused field hides, such as "+3 more", from the host's messages. |
| `name` | text | true | | | The entry's form name. Passing it renders the no-JS baseline, a plain search input in the host's GET form; left out, the field renders inert until scripts run. |
| `onActiveItemChange` | callback | true | | | Called with the item id when the tab stop moves, by a key, a click or a removal. |

The remaining props reach the entry.

## ds:hasModifierFamily

- **Density**, from the scope.
- **Surface**, set on its suggestions list to the layer one above its host's (Surface2 on a page
  at Surface1), so that list's surface channels resolve to that layer. The option hover binds
  the layer2 ghost step until a surface-routed hover channel exists.


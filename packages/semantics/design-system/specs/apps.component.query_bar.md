# QueryBar

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/apps/apps.component.query_bar.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:apps.component.query_bar` |
| `rdf:type` | `ds:Component` |
| `ds:name` | QueryBar |
| `ds:tier` | `ds:apps` |
| `ds:hasSubcomponent` | `ds:apps.subcomponent.query_bar-sheet` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.density` |

It composes `ds:global.subcomponent.query_input`, `ds:global.group.query_chips`,
`ds:global.component.segmented_chip`, `ds:global.component.filter_button`,
`ds:global.component.button`, `ds:global.component.badge` and
`ds:global.subcomponent.field-error`. It is implemented by `DataViews.QueryBar` in
@canonical/dataviews-react.

## ds:summary

A query bar narrows a collection with typed clauses and free text in one field. Each clause is
a segmented chip: a field, an operator and a value. It places them in a **QueryInput**, whose
suggestions it fills with fields, operators and values as the person types. It commits each
clause to the store's query state, and it reads the chips, the counts and the `current` marks
from that state. Unlike **SearchInput**, which takes one piece of text, a query bar builds
structured clauses. Unlike Landscape's **Search Query Editor**, it needs no grammar: every
clause is built from suggestions.

## ds:usage

### When to use

- An application list has several filterable fields, and people combine them with free text:
  machines, instances, volumes, events.
- The fields' values are known, or the source can suggest them.

### When not to use

- Free text only: use **SearchInput**.
- Two or three fields with few values: quick filters alone (**FilterButton**) are enough.
- A form whose values are saved: use a **Form** with fields.

## ds:guidelines

### Accessibility

- The QueryInput carries the combobox, the toolbar and the focus ring. The bar gives it its
  `label`, and its `description` states the keys the bar handles: "Left and Right to move
  between filters, Enter to edit, Backspace or Delete to remove". The toolbar's composite role
  tells screen readers in browse mode to pass the arrow keys through. The chips' list is named
  "Applied filters".
- The bar moves the toolbar's one tab stop across the segments and the entry by controlling
  QueryInput's `activeItem` with `onActiveItemChange`; the roving context passes it down to
  them. Every chip it renders has an `id`. While a segment is edited, the bar places the
  QueryInput's entry in that segment's editor slot.
- Left and Right move between the entry and the chips; focus lands on a chip's first segment,
  so Enter edits the chip from there. Tab and Shift+Tab walk the segments while editing; Tab
  from the last segment, or Shift+Tab from the first, commits the chip and moves focus out of it
  in that direction. Backspace on an empty entry selects the last chip; typing while a chip is
  selected returns to the entry and starts a new chip. Backspace and Delete remove a selected
  chip; Escape leaves editing.
- After a chip is removed, by a key, its remove control or a click, focus and the tab stop move
  to the next chip's first segment, or to the previous chip when none follows, or to the entry
  when no chip remains.
- The QueryInput's clear button clears the filters and the search. The summary button's name
  carries the count its Badge shows: "Filters, 2 applied".
- The bar fills every word the global blocks show from its messages: each segment's `label`,
  each chip's `removeLabel`, the QueryInput's `clearLabel` and the entry's format description,
  and each quick filter's `appliedLabel`.
- The bar fills the QueryInput's options for the segment being edited, with facet counts and
  operator symbols as their hints: "deployed, 12 machines". A field that a chip already holds
  is the `current` option.
- A value's format, such as a date's, is the QueryInput's `template`; a number's display unit
  is its `suffix`. A value that does not parse is invalid; it is not refused keystroke by
  keystroke.
- Every outcome is announced politely: a clause added, changed or removed, with the new result
  count; a selection; a warning. Announcements describe what is shown. They go to the bar's
  status region, or, while the sheet is open and the page behind it is inert, to the status
  region inside the sheet.
- Errors and warnings stay visible while the field has focus.

### Without scripts

The query belongs to the store's query state, held in memory by default. A navigation adapter,
such as one for the window location, React Router or the consumer's own router, is opt-in;
when present, it projects that state into the URL. The baseline below renders only
when the configured adapter can spell addresses, by providing `href`. Under the in-memory
default the server renders the controls inert, and they work once scripts run.

- The search is a native search form around the QueryInput, a plain text input then.
- Each applied clause is text with a Remove link to the address of the query without it, and
  a Clear link to the address of the query without its filters and search.
- On wide containers, the full filters GET form sits in an inline `<details>` disclosure,
  whose submit is Apply.
- On narrow containers, the summary button, "Filters, 2 applied", opens the sheet's
  `<dialog>` through invoker commands, and the dialog holds the same form. The sheet has no
  `<details>` fallback.
- Native buttons whose behaviour is declarative work at first paint under either default, so
  they render from the start: the summary button, the sheet's close button and the quick
  filters' popover triggers.
- What needs scripts does not render before them: no combobox role, no toolbar role, no
  suggestions, and no chip segment as a button. Each Remove link stays the same element once
  scripts run, with its click intercepted.

### States & interaction

The bar has several interacting modes, so its states are specified here.

| Mode | Entered by | Leaves to |
|---|---|---|
| idle | load; Escape; blur | field, on focus or typing |
| field | focus or typing | operator, on choosing a field; search text, on Enter with free text |
| operator | a field chosen | value, on choosing an operator; idle, on Escape |
| value | an operator chosen | idle with a committed chip, on Enter, Space after a complete value, or blur |
| chip selected | Left from the entry's start, or Backspace on an empty entry | editing, on Enter; removal, on Delete or Backspace, with focus moving to the next chip, else the previous, else the entry; the entry, on Escape or typing |
| editing | a click on a segment, or Enter on a selected chip | idle, with the chip committed, on Enter or blur out of the field, or on Tab past the last segment or Shift+Tab before the first |

- A choice of several values takes two Enters: the first adds the highlighted value, the second
  commits the chip.
- An edit that makes a chip invalid keeps the clause that applied before and says so.
- A clause whose value is still being typed is not an error until it is committed.
- Two clauses that cannot both hold produce a warning with a Merge action; the query still
  applies.
- Below a narrow container width, the bar hides the chips and shows the QueryInput's search
  entry and clear button beside a summary button that opens the sheet.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `label` | text | true | a message naming the collection | | The QueryInput's `label`. |
| `quickFilters` | list of text | true | none | field names the schema declares; an unknown name throws | The fields shown as quick filters beside the field. |
| `presets` | object | true | none | per field name, a list of `{ label, resolve }` | Named shortcuts per field, resolved when they are committed. |

The remaining props are those of the root `div`, apart from `children` and `role`.

## ds:hasModifierFamily

- **Density**, applying to the whole bar.

The bar does not take Surface itself: its QueryInput's suggestions and its sheet each set it
on their own surface.

# QueryBar

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global_dataviews/global_dataviews.component.query_bar.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.component.query_bar` |
| `rdf:type` | `ds:Component` |
| `ds:name` | QueryBar |
| `ds:tier` | `ds:global_dataviews` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.density`, `ds:global.modifier_family.surface` |

It composes `ds:global_dataviews.subcomponent.query_input`,
`ds:global_dataviews.group.query_chips`, `ds:global_dataviews.component.query_chip` with its
`ds:global_dataviews.subcomponent.query_chip-segment` and
`ds:global_dataviews.subcomponent.query_chip-entry`,
`ds:global_dataviews.component.filter_button`, `ds:global.component.button`,
`ds:global.component.badge` and `ds:global.subcomponent.field-error`. It is implemented by
`DataViews.QueryBar` in @canonical/dataviews-react.

## ds:summary

A query bar narrows a collection with typed clauses and free text in one field. Each clause is
a query chip: a field, an operator and a value. It places them in a **QueryInput**, whose
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
- The bar moves the toolbar's one tab stop across the chips and the entry by
  controlling QueryInput's `activeItem` with `onActiveItemChange`; the roving context passes it
  down to them. Every chip it renders in the toolbar has an `id`; the sheet's read-only chips
  need none.
- Building and editing are one mechanism. Once a field is chosen from the QueryInput's entry,
  the bar renders a draft chip: a Segment for the field, followed by a QueryChip.Entry, which
  takes focus. The Entry moves right as the operator and then the value are chosen. Editing a
  part swaps its Segment for an Entry, which takes focus.
- Left and Right move between the entry and the chips; focus lands on a chip's first Segment,
  so Enter edits the chip from there. Tab and Shift+Tab move the Entry across the parts while
  editing; Tab from the last part, or Shift+Tab from the first, commits the chip and moves
  focus out of it in that direction. Backspace on an empty entry selects the last chip; typing
  while a chip is selected returns to the entry and starts a new chip. Backspace and Delete
  remove a selected chip; Escape leaves editing.
- After a chip is removed, by a key, its remove control or a click, focus and the tab stop move
  to the next chip's first Segment, or to the previous chip when none follows, or to the entry
  when no chip remains.
- When an Entry unmounts, focus and `activeItem` move to a part that remains:
  - a draft chip committed, by Enter, by Space after a complete value, or by blur: the
    free-text entry, so the next clause can start; on blur, only the tab stop moves;
  - a draft chip abandoned with Escape, or removed while it is being built: the free-text
    entry, and the draft chip is gone;
  - an edit committed by Enter, or left with Escape: the Segment that takes the Entry's place,
    with Escape restoring the part's previous value.
- While the suggestions are open, the first Escape only closes them; a second Escape leaves the
  draft or the edit.
- The QueryInput's clear button clears the filters and the search. The summary button's name
  carries the count its Badge shows: "Filters, 2 applied". The count's words, from the bar's
  messages, render as visually hidden text after the label, preceded by a comma and a space,
  and the Badge is `aria-hidden`, so the visible label stays a prefix of the name.
- The bar fills every word the blocks it composes show from its messages: each Segment's
  `label`, each chip's `label` and `removeLabel`, each Entry's `label` and `formatDescription`,
  the QueryInput's `clearLabel`, `loadingLabel` and `emptyText`, and each quick filter's
  `appliedLabel`.
- The bar fills the QueryInput's options for the part being typed, with facet counts and
  operator symbols as their hints: "deployed, 12 machines". A field that a chip already holds
  is the `current` option.
- A value's format, such as a date's, is the Entry's `template`; a number's display unit is
  its `suffix`. A value that does not parse is invalid; it is not refused keystroke by
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

- The search is a native search form around the QueryInput, a plain text input then, with
  hidden inputs carrying the applied filters, so a search keeps them.
- Each applied clause is text with a Remove link to the address of the query without it, and
  a Clear link to the address of the query without its filters and search.
- On wide containers, the full filters GET form sits in an inline `<details>` disclosure,
  whose submit is Apply. It carries the search text `q` as a hidden input, so Apply keeps the
  search, as the sheet's form does.
- On narrow containers, the summary button, "Filters, 2 applied", opens the sheet's
  `<dialog>` through invoker commands, and the dialog holds the same form. The sheet has no
  `<details>` fallback.
- Each quick filter's panel is a GET form whose submit is Apply. It carries the search text `q`
  and every other applied clause as hidden inputs, so Apply changes only its own field.
- Native buttons whose behaviour is declarative work at first paint under either default, so
  they render from the start: the summary button, the sheet's close button and the quick
  filters' popover triggers.
- What needs scripts does not render before them: no combobox role, no toolbar role, no
  suggestions, no chip Entry, and no Segment as a button. Each Remove link stays the same
  element once scripts run, with its click intercepted.

### States & interaction

The bar has several interacting modes, so its states are specified here.

| Mode | Entered by | Leaves to |
|---|---|---|
| idle | load; Escape; blur | field, on focus or typing |
| field | focus or typing | operator, on choosing a field; search text, on Enter with free text |
| operator | a field chosen | value, on choosing an operator; idle, on Escape, with the draft abandoned and focus on the entry |
| value | an operator chosen | idle with a committed chip and focus on the entry, on Enter, Space after a complete value, or blur; idle, on Escape, with the draft abandoned and focus on the entry |
| chip selected | Left from the entry's start, or Backspace on an empty entry | editing, on Enter; removal, on Delete or Backspace, with focus moving to the next chip, else the previous, else the entry; the entry, on Escape or typing |
| editing | a click on a Segment, or Enter on a selected chip, which swaps that Segment for an Entry | idle, with the chip committed and focus on the restored Segment, on Enter; idle, on blur out of the field, or on Tab past the last part or Shift+Tab before the first; chip selected, on Escape, with the part's previous value and focus on its Segment |

- A choice of several values takes two Enters: the first adds the highlighted value, the second
  commits the chip.
- An edit that makes a chip invalid keeps the clause that applied before and says so.
- A clause whose value is still being typed is not an error until it is committed.
- Two clauses that cannot both hold produce a warning with a Merge action; the query still
  applies.
- Below a narrow container width, the bar hides the chips and shows the QueryInput's search
  entry and clear button beside a summary button that opens the sheet.
- When the chips are hidden, the bar sets `activeItem` to `entry`, and moves focus to the entry
  if focus was within a chip, so the tab stop never rests on a hidden item. The container query
  cannot do this, so the bar observes the container's size.

### The narrow form

Below a narrow container width, the bar's summary button opens a sheet: the full-screen form
of the query bar. It lists the applied clauses, each removable, offers "Add filter" once
scripts run, and holds the full filters form. It keeps no state of its own: with scripts, each
change commits to the query state as it is made, and the results behind it update. It is part
of the bar, not a block of its own, because no consumer composes it.

#### Accessibility

- The sheet is a native `<dialog>` filling the viewport, labelled by its title with
  `aria-labelledby`.
- The summary button opens it with invoker commands, `commandfor` naming the dialog and
  `command="show-modal"`, and the close button, named "Close filters", closes it with
  `command="close"`. The platform makes the rest of the page inert, moves focus into the
  dialog, and returns focus to the summary button on close. The invoker commands need no
  scripts, so the dialog opens before they run.
- With scripts, each control commits to the query state as it changes. The footer's primary
  button reads "Show N results", where N is the live result count derived from that state; it
  is named by its visible text and only closes the dialog, with `command="close"`. While no
  count is known it reads "Show results"; N carries the count's exactness, as in "Show 1,000+
  results".
- Clear all clears the filters only; the search stays. After it, focus moves to the first
  filters control.
- The applied chips are read-only: they take `onRemove` or `removeHref`, and their Segments
  take no `onActivate`, so the Segments are plain text and each chip's one tab stop is its
  remove control. A refused chip's remove control is also described by the reason, so the
  refusal is heard as well as seen. After a chip is removed, focus moves to the next chip's
  remove control, or to the previous chip's when none follows, or to the first filters control
  when no chip remains.
- Once scripts run, "Add filter" follows the chips. It walks field, operator and value as
  full-width lists inside the sheet, not as a popover, and commits its chip when the chip is
  complete. It is absent before scripts run.
- The field and operator steps of "Add filter", and the value step for an enumerable value, are
  each a `role="listbox"` of `option`s inside the modal dialog, named by its step, such as
  "Choose a field", with QueryInput's option semantics: disabled and `current` options carry
  `aria-disabled`, and an option's hint is part of its name. Focus moves to the first option of
  each new step, and the sheet's status region announces each step change politely. When the
  chip commits, focus moves to the new chip's remove control, and the region announces the
  added clause and the new count.
- A value step for several values takes `aria-multiselectable="true"`: Space toggles an option,
  and an Add button commits the chip. A typed value, for Match, Range, a date or a number, is a
  labelled text input with the Entry's `formatDescription`, `aria-invalid` on a parse error,
  and an Add button; Enter commits too. Focus starts on the first option or on the input, and
  moves to the new chip's remove control when the chip commits.
- Each step of "Add filter" has a Back button, which returns to the previous step, or, on the
  first step, leaves the walk. While the walk is open, Escape leaves it rather than closing the
  sheet: the walk handles Escape on `keydown` and prevents its default, which suppresses the
  close request, and cancels the dialog's `cancel` event as a backup. Leaving the walk discards
  the incomplete chip and returns focus to "Add filter".
- Outside the "Add filter" walk, the sheet closes natively on Escape and the back gesture,
  which reach the modal dialog as its close request, and through the close button and the "Show
  N results" button. It adds no history entry, so closing it never loads an earlier query.
  Nothing applied is discarded, because nothing is staged; closing during the walk discards
  only its incomplete chip.
- Once scripts run, the result count after each commit is announced politely, coalesced,
  through a visually hidden, atomic `role="status"` region inside the dialog, which stays in
  the accessibility tree while the page behind it is inert. The changing button label is not
  relied on for it. Focus stays on the control that changed and is never moved to the button or
  the count.
- Every target is at least 24 by 24 px.

#### Without scripts

Only when the bar's navigation adapter can spell addresses, by providing `href`, does the
sheet render a baseline that works before scripts run. Then one GET form wraps its header, body
and footer, so its primary button is that form's Apply submit, and Clear all is a link to the
address of the query without its filters. The form carries the search text `q` as a hidden
input, so Apply keeps the search. Otherwise the same element is a plain container:
under the default in-memory query state there is no address to spell, so the controls render
inert and work once scripts run; the dialog itself still opens.

#### States & interaction

The sheet is closed or open. It holds no state: every change commits as it is made, and
closing changes nothing.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `label` | text | true | a message naming the collection | | The QueryInput's `label`. |
| `quickFilters` | list of text | true | none | field names the schema declares; an unknown name throws | The fields shown as quick filters beside the field. |
| `presets` | object | true | none | per field name, a list of `{ label, resolve }` | Named shortcuts per field, resolved when they are committed. |

The remaining props are those of the root `div`, apart from `children` and `role`.

## ds:hasModifierFamily

- **Density**, applying to the whole bar.
- **Surface**, set to Modal on its sheet, so the sheet's surface resolves to the modal layer.
  The QueryInput's suggestions set their own.

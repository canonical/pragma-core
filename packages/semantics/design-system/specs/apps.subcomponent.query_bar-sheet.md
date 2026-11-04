# QueryBar.Sheet

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/apps/apps.subcomponent.query_bar-sheet.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:apps.subcomponent.query_bar-sheet` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | QueryBar.Sheet |
| `ds:tier` | `ds:apps` |
| `ds:parentComponent` | `ds:apps.component.query_bar` |
| `ds:standalone` | false |
| `ds:hasModifierFamily` | `ds:global.modifier_family.surface` |

## ds:summary

The full-screen form of the query bar for narrow containers. It lists the applied clauses,
each removable, offers "Add filter" once scripts run, and holds the full filters form. It
keeps no state of its own: with scripts, each change commits to the query state as it is
made, and the results behind it update.

## ds:usage

### When to use

- When the query bar's container is narrower than its threshold, opened from the summary
  button.

### When not to use

- On wide containers, where the bar edits in place.
- For unrelated forms: use **Modal**.

## ds:guidelines

### Accessibility

- A native `<dialog>` filling the viewport, labelled by its title with `aria-labelledby`.
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
- The applied chips are read-only: they take `onRemove` or `removeHref` and no
  `onSegmentActivate`, so their segments are plain text and each chip's one tab stop is its
  remove control. A refused chip's remove control is also described by the reason, so the
  refusal is heard as well as seen. After a chip is removed, focus moves to the next chip's
  remove control, or to the previous chip's when none follows, or to the first filters control
  when no chip remains.
- Once scripts run, "Add filter" follows the chips. It walks field, operator and value as
  full-width lists inside the sheet, not as a popover, and commits its chip when the chip is
  complete. It is absent before scripts run.
- The sheet closes natively on Escape and the back gesture, which reach the modal dialog as
  its close request, and through the close button and the "Show N results" button. It adds no
  history entry, so closing it never loads an earlier query. Nothing is discarded, because
  nothing is staged.
- Once scripts run, the result count after each commit is announced politely, coalesced,
  through a visually hidden, atomic `role="status"` region inside the dialog, which stays in
  the accessibility tree while the page behind it is inert. The changing button label is not
  relied on for it. Focus stays on the control that changed and is never moved to the button or
  the count.
- Every target is at least 24 by 24 px.

### Without scripts

Only when the bar's navigation adapter can spell addresses, by providing `href`, does the
sheet render a baseline that works before scripts run. Then one GET form wraps its header, body
and footer, so its primary button is that form's Apply submit, and Clear all is a link to the
address of the query without its filters. Otherwise the same element is a plain container:
under the default in-memory query state there is no address to spell, so the controls render
inert and work once scripts run; the dialog itself still opens.

### States & interaction

The sheet is closed or open. It holds no state: every change commits as it is made, and
closing changes nothing.

## ds:hasProperty

None public.

## ds:hasModifierFamily

- **Surface**, set to Modal on its own surface, so its surface resolves to the modal layer.

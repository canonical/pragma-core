# FilterButton

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global_dataviews/global_dataviews.component.filter_button.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.component.filter_button` |
| `rdf:type` | `ds:Component` |
| `ds:name` | FilterButton |
| `ds:tier` | `ds:global_dataviews` |
| `ds:inheritsFrom` | `ds:global.component.button` |
| `ds:hasModifierFamily` | `ds:global.modifier_family.density`, `ds:global.modifier_family.surface` |

Like DropdownButton, it specialises Button, whose name it takes with a prefix and whose rest
props it passes on; Button's `ds:specializedBy` gains
`ds:global_dataviews.component.filter_button`. It composes
`ds:global.component.dropdown_button`, whose panel holds its content, and
`ds:global.component.badge` for the count. A filter's panel typically holds
`ds:global.subcomponent.checkbox_input` options, a `ds:global.subcomponent.search_input` for
long lists, and a `ds:global.component.button` that submits without scripts. The graph's change
log of 2026-05-01 calls for this component: "A new component dedicated to triggering filters …
should include an active state, and other filter-related features."

## ds:summary

A filter button opens the controls of one filter and shows whether that filter applies, and how
many values it holds. Unlike **DropdownButton**, its purpose is filtering, and it carries an
applied state. Unlike **Chip**, it opens a filter's controls rather than standing for an
applied value. It serves the few filters people use most beside a search or a query bar, such
as status, tags or pool.

## ds:usage

### When to use

- Beside a search or a query bar, for the few filters people use most.
- When a filter's values fit a short list, or a small custom control.

### When not to use

- For commands or navigation: use **DropdownButton** with a menu.
- For many fields at once: use the **QueryBar**, or a form.

## ds:guidelines

### Accessibility

- The trigger is a native button that opens a non-modal panel, a native popover. Both work
  before scripts run.
- The panel follows DropdownButton's: a non-modal dialog, `role="dialog"`, named by the trigger
  through `aria-labelledby`, and the trigger takes `aria-haspopup="dialog"`.
- The trigger opens a panel, so it takes no `aria-pressed`. Its accessible name carries the
  applied count instead: `label` followed by `appliedLabel`, as in "Status, 2 applied", or
  "Status, none of 2" with an Exclusion clause. FilterButton writes no words of its own: the
  host takes `appliedLabel` from its messages. It renders as visually hidden text after the
  label, preceded by a comma and a space that FilterButton adds, and the Badge is
  `aria-hidden`, so the name reads "Status, 2 applied" and the visible label stays its prefix.
- A Badge shows the count, so the applied state does not rest on colour.
- While the filter applies, the trigger shows its clause's Condition mark before the count,
  such as `≠` for an Exclusion clause, so the condition does not rest on the name alone. The
  mark is hidden from assistive technology, because `appliedLabel` already says so.
- The panel stays open while its controls change.
- In a checkbox list, an option's count is part of its checkbox's accessible name, because the
  option is a `<label>` around the checkbox, its text and its count, with a visually hidden
  comma and space before the count: "deployed, 12".

### Without scripts

The trigger and its native popover open the panel before scripts run in every case.
FilterButton renders no form: the panel's content is the host's `children`. A host that can
spell addresses may pass a GET form with a visible Apply submit, hidden once scripts run; a
host that cannot, as under an in-memory query state, renders its controls inert, and they work
once scripts run.

### States & interaction

| State | Entered by | Shown as |
|---|---|---|
| default | nothing applies | Button's tertiary face, fixed: FilterButton takes no `importance` |
| hover | the pointer | the tertiary hover step |
| open | activation | the hover step, with the chevron turned |
| applied | `applied` above 0 | the Badge with the count; the applied fill has no symbol yet |
| with a condition | `applied` above 0 and `condition` set | the applied state, with the Condition value's mark before the count |
| disabled | `disabled` | Button's disabled face |

- With scripts, each choice commits when it is ticked: one transition per choice. Closing the
  panel commits nothing.
- Without scripts, where the host's children are a GET form, its Apply submit commits.
- Escape and an outside click close the panel; focus leaving it does not. Escape returns focus
  to the trigger, as the trigger does when it closes the panel. An outside click leaves focus
  where the person moved it.

### Composition

- FilterButton is a component around DropdownButton's `withDropdownButton` applied to Button
  once, at module scope. FilterButton provides its own props through a context above the
  trigger, and the render function reads them, so its count and its panel stay dynamic.
- Its rest props are Button's and reach the trigger unchanged. An `onClick` composes with the
  toggle: the consumer's handler runs first, and `preventDefault()` cancels the toggle.
- There is no `open` property: the open state lives in the popover. A consumer hears it change
  through `onToggle`, which fires for Escape, light dismiss, the trigger and `hide()` alike, and
  drives the panel through `panelRef`.
- There are no separate trigger or panel props. The panel takes its `id`, its `ref`,
  `aria-labelledby` naming the trigger, and `onToggle`.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `label` | node | false | | | The filter's name. |
| `applied` | number | true | 0 | an integer, 0 or more | How many values the filter applies; 0 means none. |
| `appliedLabel` | text | true | | required while `applied` is above 0 | The resolved words for the count in the trigger's name, such as "2 applied" or "none of 2", from the host's messages. |
| `condition` | choice | true | | `[inclusion, exclusion, match, range, presence]` | The Condition value of the applied clause. The trigger shows its mark before the count, and the host's `appliedLabel` says it in words, such as "none of 2" for Exclusion. |
| `children` | node | false | | | The panel's content: a checkbox list, or any control. |
| `onToggle` | callback | true | | | The panel's native toggle event, composed with the panel's own listener, so a consumer hears the panel open or close however it happens. |
| `panelRef` | object | true | | `{ show, hide, toggle }` | The panel's handle, for a host that takes the filter over. |

The remaining props are Button's, apart from `importance`, which is fixed at Tertiary.

## ds:hasModifierFamily

- **Density**, from the scope.
- **Surface**, set on its panel to the layer one above its host's (Surface2 on a page at
  Surface1), so the panel's surface channels resolve to that layer. The option hover binds the
  layer2 ghost step until a surface-routed hover channel exists.

FilterButton takes a Condition value as its `condition` property, not the family: the trigger
reads no Condition tone and shows only the value's mark. Its Tertiary face is fixed, so it does
not take Importance either.

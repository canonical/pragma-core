# QueryChip.Entry

A block specification, drafted for entry into the database of record. Its anatomy is
`anatomies/authored/global_dataviews/global_dataviews.subcomponent.query_chip-entry.yaml`.

| Predicate | Value |
|---|---|
| IRI | `ds:global_dataviews.subcomponent.query_chip-entry` |
| `rdf:type` | `ds:Subcomponent` |
| `ds:name` | QueryChip.Entry |
| `ds:tier` | `ds:global_dataviews` |
| `ds:parentComponent` | `ds:global_dataviews.component.query_chip` |
| `ds:standalone` | false |

## ds:summary

The part of a query chip being typed or edited: a text input inside the chip, where its
operator or its value is chosen. A chip holds at most one. When a part is settled, the host
replaces the Entry with a Segment, or moves it to the next part.

## ds:usage

### When to use

- Inside a QueryChip, for the one part being typed: the next part of a draft chip, or the part
  being edited.

### When not to use

- For a settled part: use **QueryChip.Segment**.
- For free text or the first field: that is **QueryInput**'s own entry.
- On its own: use **TextInput** or **ComboboxInput**.

## ds:guidelines

### Accessibility

- The Entry is a native `<input>`, never a `<textarea>`, which admits no combobox role. A long
  value scrolls inside the input rather than wrapping.
- It renders only once scripts run. It takes `role="combobox"` and is named by `label`, such as
  "Value for status". It reads QueryInput's suggestions through QueryInput's context, and while
  it has focus it carries `aria-controls`, `aria-expanded` and `aria-activedescendant` for
  QueryInput's listbox. It keeps focus while an option is highlighted.
- Inside a roving composite, the Entry is its chip's toolbar item while it is present, as
  `<id>:entry`, and takes `tabindex="0"` only while it holds the tab stop.
- Its accessible description is always its `formatDescription`, when given, followed while
  invalid by its `description`; while invalid it also carries `aria-invalid`.
- A format template is hidden from assistive technology; `formatDescription` says the format
  in words.
- Typing is never blocked by key filtering, so paste, dictation and input methods work. The
  host parses what was typed.

### States & interaction

The Entry is default, focused or invalid. It has its own look, an input fill with an
underline, so the chip shows no editing state. Keys the combobox does not handle reach the
host, which owns moving between parts and chips. Blur ends an edit only when focus leaves
QueryInput's root, a `focusout` whose `relatedTarget` is outside it.

## ds:hasProperty

| `ds:name` | `ds:propertyType` | `ds:optional` | `ds:defaultValue` | `ds:constraints` | `ds:summary` |
|---|---|---|---|---|---|
| `value` | text | false | | | The typed text. |
| `onValueChange` | callback | false | | | Called with the typed text after each input. |
| `label` | text | false | | | The accessible name, such as "Value for status". |
| `placeholder` | text | true | | | Shown while nothing is typed. |
| `template` | text | true | | | A format template shown behind the typed text, such as `YYYY-MM-DD`. |
| `formatDescription` | text | true | | required with `template` | The format in words, such as "Date, format YYYY-MM-DD", from the host's messages. It is always in the accessible description, before `description` while invalid. |
| `suffix` | text | true | | | Text after the typed text, such as a unit, as TextInput's `suffix` is. |
| `invalid` | boolean | true | false | requires `description` | Marks the typed text invalid. |
| `description` | text | true | | required with `invalid` | The message, such as "Invalid: <message>". |

The remaining props reach the `<input>`.

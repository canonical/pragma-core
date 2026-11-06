# IconButton

A drafted block, awaiting entry into the database of record. Each section below names the ontology field it fills.

- **IRI:** `ds:global.component.icon_button`
- **Type:** `ds:Component`
- **Name (`ds:name`):** IconButton
- **Tier (`ds:tier`):** `ds:global`
- **Inherits from (`ds:inheritsFrom`):** `ds:global.component.button`
- **Modifier families (`ds:hasModifierFamily`):** `ds:global.modifier_family.importance`, `ds:global.modifier_family.anticipation`
- **Documentation stage (`ds:documentationStage`):** `ds:tag.needsdefinition`. It moves to `ds:tag.needsdocumentation` once the anatomy is written to the block.

## Summary (`ds:summary`)

An icon button is a square Button that shows a single icon and no visible label. Use it for very common actions with a recognizable icon, such as edit, delete or close in a table row, for the trigger of a settings or options panel, and for actions that sit side by side in a toolbar. Unlike a Button with an icon and a label, its box is exactly as wide as it is tall in every density, and its baseline sits where a labelled Button's label baseline sits, so it lines up with text and with other buttons in a row. It has no visible text, so it is always named explicitly and always paired with a Tooltip that states the action.

## Usage (`ds:usage`)

An icon button carries an action whose icon is widely recognized, where a written label would take more room than the layout has. It behaves as a Button in every other respect: it takes Button's hierarchy and anticipation, its loading and disabled states, and its density. Because it has no visible text, its action is stated twice: by its accessible name, for assistive technology, and by the Tooltip it is paired with, for sighted users.

### When to use

- For very common actions with a recognizable icon, such as edit, delete, copy or close, where space is limited
- For the triggers of a menu or a panel whose icon names the action, such as a gear for settings or three vertical dots for more options
- In toolbars and table rows where several such actions sit side by side

### When not to use

- When the icon alone would not tell the user what happens: use a Button with a label, with or without an icon
- When the button opens a menu and needs a visible cue that it does: use a DropdownButton, which carries a chevron
- For navigation to another page: use a link
- For the main action of a page or section: use a Button with a label, so the action is written out

## Guidelines (`ds:guidelines`)

### Pair it with a Tooltip

Always pair an icon button with a Tooltip that states the action clearly, as Button's "Icon buttons" guideline asks. The Tooltip is composed around the icon button; it is not part of it. Keep the icon button's own box the root element, so its size, its margins and its place in a row stay where the consumer puts them. Use the Tooltip's own delay so it does not interrupt the user.

When the icon button opens a menu or a panel, keep the Tooltip closed while the panel is open, so the Tooltip never covers what the button opened.

### Content

An icon button shows one icon and no text. Choose an icon whose meaning is settled across products; when no icon is that clear, use a Button with a label instead. Write the Tooltip as the action, a verb and a noun in sentence case, such as "Delete instance", and keep it to a few words.

### Size, alignment and responsiveness

The box is the density cell in both directions: it follows the context and the density it sits in, as a labelled Button does. In a row aligned on the text baseline, the icon button, a labelled Button and plain text share one baseline. The icon is centred in the box.

Because the box follows the density cell, a dense icon button is small. On touch screens, prefer the comfortable density, or give the row enough space between buttons that each keeps a comfortable hit area. The hit area of a dense icon button is smaller than the one the Icon block asks for, which is an open point for the design owners.

### Hierarchy

An icon button takes Button's Importance and Anticipation modifier families. Most icon buttons are tertiary, because they sit beside the content they act on.

### Localization

- Translate the accessible name and the Tooltip message, which state the same action
- Mirror directional icons, such as arrows and chevrons, in right-to-left layouts; leave icons that do not point a direction as they are
- Allow the Tooltip message to grow in translation: it wraps, and the icon button's box does not change with it

### Animation

- Disable the colour transitions when `prefers-reduced-motion: reduce` is set, as for Button
- The Tooltip's delay is not an animation, and stays in place under reduced motion

### Accessibility

#### Accessible name

- An icon button has no visible text, so it must be named with an accessible label, or by reference to an element whose text names it
- The icon is decorative and is hidden from assistive technology
- The Tooltip repeats the name for sighted users; it does not replace the accessible name

#### Keyboard support and focus order

- The icon button is focusable and shows the focus ring Button shows
- Once focused, `Enter` or `Space` runs the action
- When it opens a menu or a panel, it exposes whether the panel is expanded

## Properties (`ds:hasProperty`)

| Name | Type (`ds:propertyType`) | Optional (`ds:optional`) | Constraints | Summary |
|---|---|---|---|---|
| icon | choice | false | | Determines the icon that is displayed in the button. It is the button's only visible content. |
| label | text | false | | The accessible name of the button, announced in place of the visible label it does not have. It is given as text, or as a reference to an element whose text names the button. |
| anticipation | choice | true | Should affect background color and border | Icon buttons can consume the Anticipation modifier family |

## On entry

- Button's entry gains `ds:specializedBy ds:global.component.icon_button`, as it carries one for DropdownButton.
- The anatomy follows as its own file under `anatomies/authored/global/` once the block is entered, because the anatomy check reads every `uri:` against the entered blocks.

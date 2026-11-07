# IconButton

A drafted block, awaiting entry. Each section names the field it fills.

- **IRI:** `ds:global.component.icon_button`
- **Type:** `ds:Component`
- **Name (`ds:name`):** IconButton
- **Tier (`ds:tier`):** `ds:global`
- **Inherits from (`ds:inheritsFrom`):** `ds:global.component.button`
- **Modifier families (`ds:hasModifierFamily`):** `ds:global.modifier_family.importance`, `ds:global.modifier_family.anticipation`
- **Documentation stage (`ds:documentationStage`):** `ds:tag.needsdefinition`, until its anatomy is written

## Summary (`ds:summary`)

An icon button is a square Button with one icon and no visible label. Use it for common actions with a recognizable icon, such as edit or delete in a table row, a settings panel trigger, or toolbar actions. Its baseline matches a labelled Button's, and it is always named and paired with a Tooltip.

## Usage (`ds:usage`)

A Button with only an icon, for actions whose icon is widely recognized. It keeps Button's hierarchy, states and density.

### When to use

- Common actions with a recognizable icon (edit, delete, copy, close) where space is short
- Triggers of a menu or panel whose icon names the action (a gear, three vertical dots)
- Rows of actions in toolbars and tables

### When not to use

- The icon alone is unclear: use a Button with a label
- A menu needs a visible cue: use a DropdownButton
- Navigation: use a link
- The main action of a page: use a Button with a label

## Guidelines (`ds:guidelines`)

### Tooltip

- Always pair it with a Tooltip that states the action, composed around the button; the button stays the root.
- Keep the Tooltip closed while a panel the button opened is open.

### Content

- One icon, no text. The Tooltip is a short verb and noun in sentence case.

### Size and responsiveness

- The box is the density cell both ways, and its baseline matches a labelled Button's. The icon is centred.
- On touch screens, prefer the comfortable density. A dense box is smaller than the Icon block's hit area, an open point.

### Hierarchy

- Takes Importance and Anticipation. Most icon buttons are tertiary.

### Localization

- Translate the accessible name and the Tooltip.
- Mirror directional icons in right-to-left layouts.

### Animation

- No colour transitions under `prefers-reduced-motion: reduce`, as for Button.

### Accessibility and keyboard

- Name it with an accessible label or a reference; the icon is hidden from assistive technology.
- Focusable with Button's focus ring; `Enter` or `Space` runs it; a panel trigger exposes whether the panel is expanded.

## Properties (`ds:hasProperty`)

| Name | Type | Optional | Constraints | Summary |
|---|---|---|---|---|
| icon | choice | false | | The icon, the button's only visible content. |
| label | text | false | | The accessible name, as text or a reference to an element. |
| anticipation | choice | true | Affects background and border | Consumes the Anticipation family. |

## On entry

- Button's entry gains `ds:specializedBy ds:global.component.icon_button`.
- The anatomy follows under `anatomies/authored/global/`.

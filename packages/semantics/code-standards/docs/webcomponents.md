# Web Components Standards

Standards for webcomponents development.

## ARIA on the interactive element

**Identifier:** `cs:webcomponents.component.a11y.aria`

Apply ARIA attributes to the element that receives user focus and interaction. In wrapper components, this is usually an inner native control (for example, button or input), not the custom-element host. When the accessible name is dynamic, expose an explicit API (for example, an aria-label property) rather than relying on projected content to infer it.

### Do

Forward accessible-name attributes to the inner interactive element.
```html
<ds-button aria-label="Close dialog"></ds-button>

<!-- Component output contract -->
<button aria-label="Close dialog">...</button>
```

Treat explicit aria props as the primary accessibility contract for icon-only controls.
```html
<ds-button aria-label="Close">
  <ds-icon name="close"></ds-icon>
</ds-button>
```

### Don't

Set ARIA only on the host when a separate inner control receives focus.
```typescript
// Bad: aria on host does not label the focused inner button
this.setAttribute("aria-label", "Close dialog");
```

Rely exclusively on projected content to derive accessible names for critical controls.
```html
<!-- Bad: no explicit accessible name contract -->
<ds-button>
  <ds-icon name="close"></ds-icon>
</ds-button>
```

---

## Shadow root focus delegation

**Identifier:** `cs:webcomponents.component.a11y.focus`

Use `delegatesFocus: true` when attaching a shadow root so host focus forwards to the first focusable shadow element. This avoids managing host tabindex manually for button-like components.

### Do

Attach shadow root with focus delegation enabled.
```typescript
class DsButton extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    root.innerHTML = `<button part="button"><slot></slot></button>`;
  }
}

customElements.define("ds-button", DsButton);
```

### Don't

Add host tabindex management solely to compensate for missing focus delegation when the component already wraps a native focusable control.
```typescript
// Bad: manual host focus plumbing for a wrapped native button
this.setAttribute("tabindex", "0");
this.addEventListener("focus", () => {
  this.shadowRoot?.querySelector("button")?.focus();
});
```

---

## Keyboard interaction patterns

**Identifier:** `cs:webcomponents.component.a11y.keyboard`

Interactive components must handle `keydown` events following WAI-ARIA Authoring Practices. Arrow keys navigate, `Enter`/`Space` activate, `Home`/`End` jump to first/last, `Escape` dismisses.

### Do

Handle keyboard events for the component's widget role.
```typescript
private onKeyDown(e: KeyboardEvent): void {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      this.focusNextItem();
      break;
    case "ArrowUp":
      e.preventDefault();
      this.focusPreviousItem();
      break;
    case "Home":
      e.preventDefault();
      this.focusFirstItem();
      break;
    case "End":
      e.preventDefault();
      this.focusLastItem();
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      this.toggleItem();
      break;
  }
}
```

Bind keydown handling on the interactive container and set an explicit role.
```html
<div role="tablist" onkeydown="handleTabs(event)">
  <!-- tab controls -->
</div>
```

### Don't

Use only click handlers — keyboard-only users cannot activate the UI.
```html
<!-- Bad: no keyboard handling -->
<div onclick="togglePanel()">Toggle</div>
```

---

## Namespaced CSS class names

**Identifier:** `cs:webcomponents.component.class-names`

A `componentCssClassName` constant should be defined at the top of the component module, using a ds namespace plus kebab name (for example, `ds button`). Apply it to the root element rendered inside shadow DOM, never to the host element itself — the host's class attribute is owned by consumers. When modifier states are accepted, build the class list from an array with `.filter(Boolean).join(' ')`. Child class names should be short and role-based; the root `.ds.{component}` selector provides scope.

### Do

Define a `componentCssClassName` constant and apply it on the internal root element.
```typescript
const componentCssClassName = "ds button";

const template = `
  <button class="${componentCssClassName}">
    <slot></slot>
  </button>
`;
```

When the component accepts modifier states, compose the class string from an ordered array.
```typescript
const className = [componentCssClassName, emphasis, size]
  .filter(Boolean)
  .join(" ");
```

Use short, role-based child class names and scope them under the root selector in CSS.
```css
.ds.button .header { /* ... */ }
.ds.button .content { /* ... */ }
```

### Don't

Hardcode repeated class strings inline without a shared constant.
```typescript
// Bad: repeated magic string
const template = `<button class="ds button">...</button>`;
```

Mutate host classes to inject design-system namespace classes.
```typescript
// Bad: host classes are consumer-owned
this.classList.add("ds", "button");
```

Prefix child class names with component names or BEM suffixes when root scoping already provides context.
```html
<!-- Bad: redundant prefixes -->
<div class="my-component__header"></div>
<div class="my-component-content"></div>
```

---

## Component and custom element naming

**Identifier:** `cs:webcomponents.component.naming`

Component classes must use PascalCase and be descriptive. Custom element names must be kebab-case and include a namespace (for example, `ds-button`). The class name does not include the namespace prefix — it matches the component concept only (for example, `Button`, not `DsButton`).

### Do

Use PascalCase for the class name and a namespaced kebab-case custom element tag.
```typescript
class Button extends HTMLElement {}
customElements.define('ds-button', Button);
```

### Don't

Include the namespace prefix in the class name. The namespace already exists in the tag name.
```typescript
// Bad: class name redundantly repeats namespace intent
class DsButton extends HTMLElement {}
customElements.define('ds-button', DsButton);
```

Use a non-namespaced or non-kebab-case custom element name.
```typescript
// Bad: no namespace
customElements.define('button', Button);

// Bad: not kebab-case
customElements.define('dsButton', Button);
```

---

## Typed props over open slots

**Identifier:** `cs:webcomponents.component.slots`

Default to structured data APIs (typed props such as objects and arrays) instead of open content projection. Slots allow arbitrary light-DOM markup, making styling, layout guarantees, and semantic consistency harder to enforce. Only use slots when the consumer must provide real interactive/content nodes that cannot be expressed by the component's typed API. If a slot is required, it must be explicitly named and documented as part of a constrained contract (for example, named trigger/content slots), never as an unrestricted default slot. `::slotted()` can style only direct slotted children and cannot enforce full visual control, so tokenized props remain the primary customization mechanism.

### Do

Model visual content with typed object props so rendering stays controlled by the component.
```typescript
interface ButtonContent {
  label: string;
  iconName?: string;
}

interface ButtonProps {
  content: ButtonContent;
}
```

Use arrays/objects for repeatable structured regions instead of requiring projected children.
```typescript
interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

interface MenuProps {
  items: MenuItem[];
}
```

When slot usage is unavoidable, expose only named slots with a strict contract and keep free-form default content disabled.
```html
<ds-popover>
  <button slot="trigger">Open</button>
  <div slot="content">Popover content</div>
</ds-popover>

<!-- Contract: only trigger/content named slots are accepted. -->
```

Define object-shape contracts and validate inputs at runtime for stable rendering and styling.
```typescript
interface CardActions {
  primary: { label: string; disabled?: boolean };
  secondary?: { label: string; disabled?: boolean };
}

function hasValidActions(actions?: CardActions): boolean {
  return Boolean(actions?.primary?.label);
}
```

### Don't

Expose an unrestricted default slot as a public API for core components. This permits arbitrary consumer markup and breaks visual/semantic guarantees.
```html
<!-- Bad: unrestricted default content -->
<ds-button>
  <p>Any markup can be injected here</p>
</ds-button>
```

Use slots as the primary API for data that is already representable as typed objects.
```typescript
// Bad: caller must compose markup for simple data
interface ListProps {
  itemsSlotOnly?: true;
}

// Good: accept structured data
interface BetterListProps {
  items: Array<{ label: string }>;
}
```

Rely on `::slotted()` for strict design enforcement. Slotted elements keep their own styles and can override component intent.
```css
/* Bad: consumer element styles can still win */
::slotted(*) {
  font-size: var(--text-size-2);
}
```

---

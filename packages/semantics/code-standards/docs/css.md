# CSS Standards

Standards for css development.

## Scroll-driven animations without JavaScript

**Identifier:** `cs:css.animation.scroll_timeline`

Use scroll-driven animations (`animation-timeline`, `scroll()`, `view()`) instead of scroll-event-driven animation logic. JavaScript scroll animations may be layered on as fallback when needed. See cs:ui_blocks.principles.scripting_progressive_enhancement.

### Do

Bind animation progress to scroll with CSS.
```css
.progress {
  animation: fill linear;
  animation-timeline: scroll(block);
}

@keyframes fill {
  from { scale: 0 1; }
  to { scale: 1 1; }
}
```

### Don't

Drive scroll-linked motion only from JavaScript when scroll-driven CSS can express it.
```javascript
window.addEventListener('scroll', () => {
  progress.style.transform = `scaleX(${window.scrollY / 600})`;
});
```

---

## Entry transitions with @starting-style

**Identifier:** `cs:css.animation.starting_style`

Use `@starting-style` for entry transitions when an element is inserted or toggled into view, especially for popovers and dialogs. JavaScript may be layered on as a fallback around the same declarative CSS for unsupported browsers.

### Do

Define the starting state in CSS for entry transitions.
```css
[popover] {
  opacity: 0;
  transition: all 0.3s allow-discrete;

  &:popover-open {
    opacity: 1;
  }
}

@starting-style {
  [popover]:popover-open {
    opacity: 0;
  }
}
```

### Don't

Drive entry animations only from JavaScript when `@starting-style` can be used.
```javascript
const popover = document.querySelector('[popover]');
popover.addEventListener('toggle', (e) => {
  if (e.newState === "open") {
    popover.classList.add('animate-in');
    popover.classList.remove('animate-out');
  } else {
    popover.classList.remove('animate-in');
    popover.classList.add('animate-out');
  }
})
```

---

## Scope styles to the root class

**Identifier:** `cs:css.component.encapsulation`

Component styles must be encapsulated using the component's root class as a boundary. All internal element styles must be scoped to the component's namespace.

### Do

Scope internal element styles using the component's namespace.
```css
.ds.button {
  /* Component root styles */
  
  & > .icon {
    /* Internal element styles */
    margin-right: var(--button-icon-spacing);
  }
}
```

### Don't

Don't style internal elements without the component namespace.
```css
/* Bad: Internal element not scoped to component */
.icon {
  margin-right: var(--button-icon-spacing);
}
```

---

## State attributes and modifier classes

**Identifier:** `cs:css.component.states`

Component states must be handled using attribute selectors for native states and class modifiers for custom states.

### Do

Use attribute selectors for native element states.
```css
.ds.button {
  &[disabled] {
    opacity: var(--button-disabled-opacity);
  }
}
```

### Don't

Use class modifiers for native states.
```css
/* Bad: Using class for native state */
.ds.button.disabled {
  opacity: var(--button-disabled-opacity);
}
```

---

## Container queries over ResizeObserver

**Identifier:** `cs:css.media.container_queries`

Use container queries (`container-type` and `@container`) for responsive styling based on a containing element's size. Use `ResizeObserver` only when container queries cannot express the condition, such as changes to content-driven rendered height.

### Do

Use a query container and adapt styles with @container rules.
```css
.card-grid {
  container-type: inline-size;
}

@container (min-width: 40rem) {
  .card { grid-template-columns: 1fr 1fr; }
}
```

### Don't

Use ResizeObserver for width-based layout changes that container queries can express.
```javascript
const ro = new ResizeObserver(([entry]) => {
  card.classList.toggle('wide', entry.contentRect.width >= 640);
});
ro.observe(card);
```

---

## Guard hydration flash with scripting

**Identifier:** `cs:css.media.scripting`

Use the `scripting` media feature when hydration gating would cause a FOUC-like "flash of un-javascripted content" on first paint.

### Do

When hydration gating causes first-paint flash, hide JS-only affordances by default and reveal them when scripting is enabled.
```css
.menu-button {
  display: none;
}

@media (scripting: enabled) {
  .menu-button { display: inline-flex; }
}
```

### Don't

Allow JS-only affordances to flash on first paint when they are hydration-gated.
```html
<button hidden class="menu-button">Menu</button>

<script type="module">
  document.querySelector('.menu-button').removeAttribute('hidden');
</script>
```

---

## CSS anchor positioning for tethered elements

**Identifier:** `cs:css.positioning.anchor`

Prefer CSS anchor positioning (`anchor-name`, `position-anchor`, `anchor()`, and `position-try`) for tethered elements such as popovers, tooltips, and menus. Start from a resilient baseline and layer anchor positioning; JavaScript positioning libraries may be used as fallback when needed. See cs:ui_blocks.principles.scripting_progressive_enhancement.

### Do

Start from static positioning and layer anchor positioning.
```css
.tooltip { position: absolute; top: 100%; }
.trigger { anchor-name: --t; }
.tooltip { top: anchor(--t bottom); }
```

### Don't

Default to JavaScript positioning without attempting anchor positioning.
```javascript
window.addEventListener('scroll', () => reposition(tooltip, trigger));
```

---

## Design tokens over raw values

**Identifier:** `cs:css.properties.values`

CSS properties must use design tokens for design decisions (see cs:styling.tokens.creation) and raw values for properties that are independent from design decisions, or "unthemable.

### Do

Use design tokens for design decisions.
```css
.ds.button {
  /* Design decision uses token */
  background: var(--button-background);
}
```

Use raw values for unthemable properties (independent of design decisions).
```css
.ds.skip-link {
    visibility: hidden;
}
```

### Don't

Use raw values for design decisions.
```css
.ds.button {
  /* Bad: Design decision using raw value */
  background: #0066CC;
}
```

---

## Role-based child class names

**Identifier:** `cs:css.selectors.child_elements`

Child elements within components must use simple, role-based class names (e.g., `.header`, `.content`, `.icon`) scoped by the parent selector, NOT verbose prefixed names that repeat the component name.

### Do

Use simple role-based class names scoped by the parent.
```css
.ds.accordion-item {
  & > .header {
    /* Header styles */
  }

  & > .header > .chevron {
    /* Chevron indicator */
  }

  & > .header > .heading {
    /* Heading text */
  }

  & > .content {
    /* Collapsible content */
  }
}

.ds.breadcrumbs-item {
  & > .link {
    /* Link styles */
  }

  & > .separator {
    /* Separator styles */
  }
}
```

### Don't

Use verbose prefixed class names that repeat the component name.
```css
/* Bad: Redundant component prefix in child class names */
.ds.accordion-item .accordion-item-header {
  /* 'accordion-item-' prefix is redundant */
}

.ds.accordion-item .accordion-item-chevron {
  /* Already scoped by parent, no need to repeat */
}

.ds.timeline-event .timeline-event-marker {
  /* Verbose and BEM-like */
}
```

---

## State styling with :has()

**Identifier:** `cs:css.selectors.has`

Use `:has()` to style a component from descendant or sibling state (checked, empty, invalid, open) without JavaScript-managed classes.

### Do

Style a field wrapper from the input's native state with no JavaScript class toggling.
```css
.field:has(input:user-invalid) { --label-color: var(--ds-color-negative); }
.field:has(input:focus) { outline: 2px solid var(--ds-color-focus); }
```

### Don't

Mirror child state onto a parent class with JavaScript when :has() expresses it directly.
```javascript
input.addEventListener('invalid', () => field.classList.add('is-invalid'));
```

---

## The ds selector namespace

**Identifier:** `cs:css.selectors.namespace`

All component selectors must be prefixed with the `.ds` namespace (e.g., `.ds.button`).

### Do

Prefix all component selectors with `.ds`.
```css
/* Component root with namespace */
.ds.button {
  /* Base styles */
}
```

### Don't

Omit the `.ds` namespace from component selectors.
```css
/* Bad: Missing .ds namespace */
.button {
  /* styles */
}
```

---

## Kebab-case class names

**Identifier:** `cs:css.selectors.naming_convention`

Convert PascalCase component names to kebab-case for CSS classes:
- `MyComponent` -> `.ds.my-component`
- `UserProfile` -> `.ds.user-profile`
- `Button` -> `.ds.button`

### Do

Convert PascalCase component names to kebab-case for CSS classes:
- `MyComponent` -> `.ds.my-component`
- `UserProfile` -> `.ds.user-profile`
- `Button` -> `.ds.button`

### Don't

Use PascalCase or other formats in CSS class names:
- `.ds.MyComponent` (Bad: Not kebab-case)
- `.ds.user_profile` (Bad: Not kebab-case)

---

## Name classes by purpose, not appearance

**Identifier:** `cs:css.selectors.semantics`

CSS class names must describe the purpose or state of an element, not its appearance.

### Do

Use semantic modifier classes to represent component variations.
```css
/* Semantic modifier for a primary button */
.ds.button.primary {
  --modifier-color: var(--color-primary);
}
```

### Don't

Use non-semantic or presentational class names.
```css
/* Bad: 'big' describes appearance, not purpose */
.ds.button.big {
  padding: 1rem;
}
```

---

## Flat selector specificity

**Identifier:** `cs:css.selectors.specificity`

CSS selectors must follow a strict specificity pattern:
- Component root must use namespace + component name (.ds.button)
- Single modifier class for variants (.ds.button.primary)
- Single attribute for states (.ds.button[disabled])

### Do

Use a single modifier class for component variants.
```css
.ds.button.primary {
  /* Variant: root + modifier (3 classes) */
  background: var(--button-primary-background);
}
```

### Don't

Combine multiple modifiers or mix states with variants.
```css
/* Bad: Mixing variant with state */
.ds.button.primary[disabled].large {
  /* Too specific: root + 2 modifiers + state */
}
```

---

## Activate themes with container classes

**Identifier:** `cs:css.themes.activation`

Theme tokens must be activated through CSS classes on container elements. See cs:styling.themes.definition for theme token structure.

### Do

Define semantic tokens within theme classes.
```css
.canonical {
  --spacing-vertical-medium: var(--spacing-unit-2x);
  --color-background: var(--color-neutral-100);
}
```

### Don't

Hardcode theme names in component styles.
```css
/* Bad: Component locked to specific theme */
.ds.button {
  padding: var(--canonical-spacing-vertical-medium);
}
```

---

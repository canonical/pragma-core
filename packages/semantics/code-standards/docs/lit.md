# Lit Standards

Standards for lit development.

## ARIA on the inner element

**Identifier:** `cs:lit.component.a11y.aria`

Apply ARIA attributes to the inner interactive element, not the host.

In Lit components, model the accessible-name contract as an explicit reactive prop and forward it to the inner interactive element. Consumers must supply it when the component's slot contains non-text content (e.g. an icon-only button).

As a client-only progressive enhancement, `aria-label` can also be derived from slotted text content via `@slotchange`. However, `slotchange` is a browser DOM event — it never fires during SSR. Components rendered server-side will have no derived label until hydration completes. Do not rely on the derived value as a substitute for an explicit `aria-label` prop in SSR contexts.

### Do

Require `aria-label` explicitly and treat slot-derived text as a client-side enhancement only.
```typescript
@property({ type: String, attribute: "aria-label" })
ariaLabel: string | null = null;

// Client-only enhancement: populated after hydration via the slotchange event.
// Never available during SSR — do not depend on it for accessible names.
private slottedText = "";

private onSlotChange(e: Event): void {
  const slot = e.target as HTMLSlotElement;
  this.slottedText = slot
    .assignedNodes({ flatten: true })
    .map((node) => node.textContent ?? "")
    .join("")
    .trim();
}

render() {
  // ariaLabel is the SSR-safe path.
  // slottedText is only populated after the browser fires slotchange.
  const label = this.ariaLabel || this.slottedText || undefined;
  return html`
    <button
      class="${componentCssClassName}"
      aria-label=${ifDefined(label)}
    >
      <slot @slotchange=${this.onSlotChange}></slot>
    </button>
  `;
}
```

### Don't

Set ARIA on the host when wrapping a native interactive element.
```typescript
// Bad: aria-label on the host is ignored when the inner button is focused
connectedCallback() {
  super.connectedCallback();
  this.setAttribute('aria-label', 'Click me');
}
```

Omit an explicit `aria-label` prop and rely solely on slot-derived text — this produces components with no accessible name during SSR.
```html
<!-- Bad: icon-only button with no aria-label prop. -->
<!-- In SSR, slottedText is always empty, so aria-label is never written to the markup. -->
<ds-button>
  <ds-icon name="close"></ds-icon>
</ds-button>
```

---

## Barrel exports for the public API

**Identifier:** `cs:lit.component.barrel-exports`

Each component folder must have an `index.ts` that re-exports the public API. The component must be re-exported using `export { default as [MyComponent] }` to match the `export default class` shape of the implementation file. Types must be re-exported using `export type *` (not `export *`, which would allow value exports to leak from files that should only contain type declarations).

### Do

Export the component using its default export alias and types using `export type *`.
```typescript
// index.ts
export { default as MyComponent } from './MyComponent.js';
export type * from './types.js';
```

### Don't

Use a named re-export — the component uses `export default class`, so `export { MyComponent }` would not resolve correctly.
```typescript
// Bad: doesn't match the default export shape
export { MyComponent } from './MyComponent.js';
```

Use `export *` for types — it allows value exports to leak, which types files must not do.
```typescript
// Bad
export * from './types.js';
```

Omit the barrel file or fail to re-export types — consumers will be unable to import the component or its types through the package's public API.

---

## Token inheritance across the shadow boundary

**Identifier:** `cs:lit.component.global-styles`

CSS custom properties inherit across the shadow DOM boundary. Tokens are available inside the shadow tree without redeclaration. See `cs:styling.tokens.types` and `cs:css.properties.values` for the full token rules. The one Lit-specific exception: UA stylesheets explicitly reset font properties on form elements (`button`, `input`, `select`, `textarea`). This reset fires inside the shadow tree too, so inherited `font-family` and related properties are zeroed out before they reach the component styles.

### Do

Explicitly restore inherited typography on form element roots — UA stylesheets reset these inside shadow DOM.
```css
.ds.button {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
}
```

### Don't

Create a shared CSS reset file to handle the UA font reset — each component is responsible for its own `styles.css`, and shared files violate the component folder structure standard.

---

## Side-effect imports register elements

**Identifier:** `cs:lit.component.imports`

Any file that uses a web component in a template must include a side-effect import of the component's `.js` file. This is what triggers the `@customElement` decorator and registers the element via `customElements.define()`. Without it, the element is unknown and renders as an empty node with no error thrown. The `import type` import is separate — it only provides TypeScript types and is erased at compile time. The side-effect form (`import "./file.js"`) and the value form (`import Name from "./file.js"`) are distinct constructs — only the side-effect form makes the intent explicit without importing an unused runtime value.

### Do

Include the side-effect import alongside the type import.
```typescript
import "./MyComponent.js";                        // registers the custom element at runtime
import type MyComponent from "./MyComponent.js";  // TypeScript types only
```

### Don't

Use a value import expecting to render with the class. Lit templates always use the tag name string, never the class directly. The value import becomes an unused binding.
```typescript
import MyComponent from "./MyComponent.js";

// Wrong: MyComponent cannot be used like a JSX/Lit tag
html`<${MyComponent}></${MyComponent}>`;  // not valid

// The tag name string is always the correct form
html`<ds-example></ds-example>`;
```

Assume the element is already registered because it was imported elsewhere in the project — side-effect imports must be explicit in every file that uses the element.

---

## Server rendering with declarative shadow DOM

**Identifier:** `cs:lit.component.ssr`

Lit SSR is provided by the `@lit-labs/ssr` package (currently Lit Labs — experimental). It renders Lit templates and LitElement components to static HTML in Node.js using Declarative Shadow DOM (DSD), without a full browser DOM. A minimal DOM shim (`@lit-labs/ssr-dom-shim`) is provided automatically, but most browser DOM APIs are unavailable on the server.

**Which lifecycle methods run on the server:**

| Method | Runs on server |
|---|---|
| `constructor()` | Yes ⚠️ |
| `willUpdate()` | Yes ⚠️ |
| `render()` | Yes ⚠️ |
| `hasChanged()` | Yes ⚠️ |
| `connectedCallback()` | No |
| `disconnectedCallback()` | No |
| `attributeChangedCallback()` | No |
| `shouldUpdate()` | No |
| `update()` | No |
| `firstUpdated()` | No |
| `updated()` | No |

Only `constructor()`, `willUpdate()`, and `render()` run during SSR. Any browser DOM access must be confined to the methods in the "No" column, or guarded explicitly. The `@slotchange` event is a browser DOM event — it never fires during SSR. See `cs:lit.component.a11y.aria` for the consequence of this on accessible name derivation.

### Do

Use `isServer` from `lit` to guard any browser-only logic that cannot be moved into a safe lifecycle method.
```typescript
import { LitElement, html, isServer } from 'lit';

@customElement('ds-button')
export default class Button extends LitElement {
  connectedCallback() {
    // connectedCallback() is not called on the server, so this is already
    // safe — but isServer is the explicit guard for constructor() or render()
    // if you ever need to branch there.
    super.connectedCallback();
    this.setupResizeObserver();
  }

  private setupResizeObserver() {
    if (isServer) return; // ResizeObserver does not exist in the SSR DOM shim
    this._observer = new ResizeObserver(() => { /* ... */ });
  }
}
```

Confine imperative DOM access to lifecycle methods that are not called on the server — `updated()` is the standard choice.
```typescript
updated() {
  // Safe: updated() is never called during SSR.
  // Use this for any measurement, focus management, or direct DOM access.
  this.shadowRoot?.querySelector('input')?.focus();
}
```

Use optional chaining or `typeof` guards as lightweight protection against APIs outside the SSR DOM shim, when moving code into a safe lifecycle method is not practical.
```typescript
// Checks whether the API actually exists before calling it.
// Works in both Node (undefined) and browser (function) environments.
const supportsPopover = typeof HTMLElement?.prototype?.showPopover === 'function';
```

### Don't

Access browser APIs in `constructor()`, `willUpdate()`, or `render()` — these three methods run on the server and the APIs will not exist.
```typescript
// Bad: document is not available in the SSR DOM shim
constructor() {
  super();
  this._overlay = document.createElement('div'); // throws on the server
}

// Bad: window is not available
render() {
  const width = window.innerWidth; // throws on the server
  return html`<div style="width:${width}px"></div>`;
}
```

Rely on `@slotchange` to derive values used in the server-rendered markup — the event never fires during SSR, so any value populated by it will be absent in the initial HTML.
```typescript
// Bad: slottedText is always '' during SSR.
// Any attribute derived from it (like aria-label) will be missing
// in the server-rendered HTML.
private slottedText = '';

private onSlotChange(e: Event) {
  const slot = e.target as HTMLSlotElement;
  this.slottedText = slot.assignedNodes({ flatten: true })
    .map(n => n.textContent ?? '')
    .join('')
    .trim();
}
```

---

## Keep Lit external in the bundle

**Identifier:** `cs:lit.component.ssr.bundling`

This rule applies to the component library build and publish pipeline, not to applications that consume the library.

Lit uses conditional exports in `package.json` to provide different module variants for Node and browser environments. If `lit` is bundled into the library's output, the resulting file will contain only the variant for whichever environment the bundler targeted — it will not switch at runtime. A consuming app's bundler will then resolve to this locked-in variant regardless of whether it is building for Node or the browser, silently breaking SSR or client rendering depending on which was inlined.

The fix is to keep `lit` external in the library build. The bare `lit` specifier is then left in the library's output, and each consuming app's bundler resolves it against its own `node_modules` using the correct conditional export for its target environment.

### Do

Mark `lit` and all its subpaths as external in `vite.config.ts` so the conditional exports resolve correctly at the consumer's build time.
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^lit($|\\/)/], // externalises 'lit', 'lit/decorators.js', 'lit/directives/*', etc.
    },
  },
});
```

If bundling lit is unavoidable (e.g. CDN), produce separate browser and node bundles and declare them in conditional exports.
```json
{
  "name": "my-ds",
  "exports": {
    "./button.js": {
      "node": "./dist/node/button.js",
      "default": "./dist/browser/button.js"
    }
  }
}
```

### Don't

Omit the external rule — Vite will inline lit into the output, locking in one environment's conditional export variant and silently breaking SSR or browser usage.
```typescript
// Bad: lit is bundled into the output with the browser variant inlined.
// Node consumers will get browser-variant lit with no DOM shim.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
    },
    // rollupOptions.external omitted — lit is bundled rather than kept external
  },
});
```

---

## Hydrating server-rendered components

**Identifier:** `cs:lit.component.ssr.hydration`

After the server emits Declarative Shadow DOM HTML, the client must hydrate it to restore reactivity. This requires two things:

1. `@lit-labs/ssr-client/lit-element-hydrate-support.js` — installs LitElement's hydration support. **Must be imported before `lit` and before any component module**, otherwise the hydration hook is not in place when elements upgrade.
2. Loading the component module — triggers `customElements.define()` via `@customElement`, causing the element to upgrade and self-hydrate when it detects it was server-rendered with DSD.

### Do

Import the hydration support module first, before any component or `lit` import, in the client entry point.
```typescript
// entry-client.ts — order matters
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // must be first
import './components/Button.js';   // registers ds-button, triggers self-hydration
import './components/Label.js';
```

### Don't

Import component modules before the hydration support module — hydration support must be installed before `lit` is first imported.
```typescript
// Bad: Button.ts imports lit, which runs before hydration support is installed.
import './components/Button.js';
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'; // too late
```

---

## One folder per web component

**Identifier:** `cs:lit.component.structure.folder`

Each web component must reside in its own PascalCase-named folder. Component-specific files are prefixed with the component name (`[MyComponent].ts`, `[MyComponent].stories.ts`, `[MyComponent].tests.ts`). Domain-level files use generic names without the prefix (`index.ts`, `types.ts`, `styles.css`, `constants.ts`) — the folder name already provides the namespace. Subcomponents reside in a `common/` subfolder.

### Do

Place all component-related files within a single folder named after the component.
```bash
MyComponent/
  ├── MyComponent.ts           # Component-specific
  ├── MyComponent.stories.ts   # Component-specific
  ├── MyComponent.tests.ts     # Component-specific
  ├── index.ts                 # Domain-level
  ├── types.ts                 # Domain-level
  ├── constants.ts             # Domain-level
  ├── styles.css               # Domain-level
  └── common/
      └── SubComponent.ts
```

### Don't

Scatter files across different parts of the application.
```bash
components/
  └── MyComponent.ts
styles/
  └── MyComponent.css
```

Add redundant prefixes to domain-level files — the folder name already provides the namespace.
```bash
MyComponent/
  ├── MyComponent.types.ts      # Bad: Redundant prefix
  └── MyComponent.styles.css    # Bad: Redundant prefix
```

---

## Styles in a separate CSS file

**Identifier:** `cs:lit.component.styles`

Component styles must be authored in a separate `styles.css` file, not inline as template literals. The file is imported into the component as `import styles from './styles.css'` and transformed at build time to Lit's `CSSResult` via a Vite plugin. TypeScript accepts `.css` imports through a `css.d.ts` declaration.

Two selectors are used, each with a distinct responsibility:

- **`:host`** — controls how the custom element participates in the **surrounding (outer) layout**. A custom element is `display: inline` by default; properties that belong here are those that define the element's footprint and behaviour from the parent's perspective: `display`, `width`/`min-width`/`max-width`, `align-self`/`justify-self`, `flex-grow`/`flex-shrink`/`flex-basis`, and `contain`. Nothing else belongs on `:host`.
- **`.ds.{component}`** — controls everything else: visual styles, internal layout, spacing, typography, token-based colors. The `ds` namespace scope on the root selector ensures consistent class-name structure and avoids collisions.

### Do

Author styles in a separate `.css` file and import them into the component.
```typescript
import styles from './styles.css';

export default class Button extends LitElement {
  static styles = styles;
}
```

Use `:host` only for properties that define the element's footprint in the outer layout. Set a default `display` value since custom elements are `display: inline` by default.
```css
/* Corrects the default display: inline — most components need inline-block for a proper box model */
:host {
  display: inline-block;
}

/* Full-width component — defines its own sizing footprint */
:host {
  display: block;
  width: 100%;
}
```

Always pair a default `:host` display with `:host([hidden]) { display: none }`. Without it, an explicitly set `display` on `:host` overrides the lower-specificity native `hidden` attribute, breaking `elem.hidden = true`.
```css
:host {
  display: inline-block;
}

:host([hidden]) {
  display: none;
}
```

Use `.ds.{component}` for all visual, layout, spacing, and token-based styles.
```css
.ds.button {
  display: inline-flex;
  align-items: center;
  background-color: var(
    --modifier-color,
    var(--modifier-importance-background, var(--button-color-background))
  );
}
```

### Don't

Write styles inline as template literals — doing so loses CSS tooling and file co-location.
```typescript
// Bad
static styles = css`
  .ds.button { background-color: red; }
`;
```

Put visual or internal layout styles on `:host` — they belong on `.ds.{component}`.
```css
/* Bad: visual and internal layout styles on :host */
:host {
  display: inline-flex;    /* internal layout — belongs on .ds.button */
  background-color: var(--button-color-background); /* visual — belongs on .ds.button */
  padding: 0.5rem 1rem;    /* spacing — belongs on .ds.button */
}
```

---

## The modifier token cascade

**Identifier:** `cs:lit.component.styles.variables`

Component styles follow the token hierarchy defined in `cs:styling.tokens.types` and `cs:css.properties.values`. The modifier cascade (`--modifier-color-*` → `--modifier-importance-*` → `--button-color-*`) is read via nested `var()` fallbacks — all three layers are defined outside the component's own CSS.

### Do

Use the full modifier cascade with the component token as the innermost fallback.
```css
.ds.button {
  /* Resolution: anticipation modifier → importance modifier → component token */
  background-color: var(
    --modifier-color,
    var(--modifier-importance-background, var(--button-color-background))
  );
}
```

### Don't

Redeclare a component token inside the component's own `:host` — it is already defined by the token system. Declaring it on `:host` hardcodes its value and overrides whatever the theme or consumer set.
```css
/* Bad: wins over the inherited value and breaks theming */
:host {
  --button-color-background: var(--color-action-default);
}
```

---

## Testing shadow and light DOM

**Identifier:** `cs:lit.component.testing`

Tests must query both the shadow DOM (for internals) and the light DOM (for slotted content). Always wait for custom element registration before querying the shadow tree.

Lit web component tests work directly with the DOM — there is no test-library abstraction that handles mounting and cleanup automatically. Each test suite must manually create and append the element in `beforeEach` and remove it in `afterEach`.

The element must also be typed as its concrete class (not `HTMLElement`) so properties and `updateComplete` are accessible.

### Do

Mount and unmount the element in hooks, typed as the component class.
```typescript
import "./MyComponent.js";
import type MyComponent from "./MyComponent.js";

let elem: MyComponent;

beforeEach(() => {
  elem = document.createElement("ds-my-component") as MyComponent;
  document.body.appendChild(elem);
});

afterEach(() => {
  elem.remove();
});
```

Use `customElements.whenDefined()` before querying the shadow DOM.
```typescript
it("renders", async () => {
  await customElements.whenDefined("ds-my-component");
  const container = elem.shadowRoot?.querySelector(".ds.my-component");
  expect(container).toBeTruthy();
});
```

Use `await elem.updateComplete` before asserting on reactive property changes.
```typescript
it("reflects label prop", async () => {
  elem.label = "Updated";
  await elem.updateComplete;
  expect(elem.shadowRoot?.querySelector(".ds.my-component")?.textContent?.trim()).toBe("Updated");
});
```

Query slotted content via the light DOM (`elem.querySelector`) — slotted nodes remain in the light tree and are never accessible through `shadowRoot`.
```typescript
it("renders slotted icon", async () => {
  const icon = document.createElement("ds-icon");
  icon.setAttribute("slot", "icon");
  icon.setAttribute("name", "arrow-right");
  elem.appendChild(icon);

  await elem.updateComplete;

  // correct: slotted content lives in the light DOM
  const slottedIcon = elem.querySelector("ds-icon[slot='icon']");
  expect(slottedIcon).toBeTruthy();
});
```

### Don't

Type the element as `HTMLElement` — it loses access to component properties and `updateComplete`.
```typescript
// Bad
let elem: HTMLElement;
elem = document.createElement("ds-my-component");
```

Query the shadow DOM before the element is defined or before `updateComplete` resolves when testing reactive properties — the shadow tree may not yet exist or may reflect stale state.

Use `shadowRoot` to assert on slotted content — slotted nodes are projected from the light DOM and will never appear inside `shadowRoot`.
```typescript
// Bad: always returns null; slotted children are not in the shadow tree
const icon = elem.shadowRoot?.querySelector("ds-icon[slot='icon']");
```

---

## Component TSDoc from the ontology

**Identifier:** `cs:lit.component.tsdoc`

Component TSDoc documentation must use the description from the design system ontology (DSL). The TSDoc should NOT include `@example` blocks since stories serve as the examples. The description should be copied verbatim from the DSL, maintaining the original wording and meaning.

### Do

Use the description from the DSL ontology verbatim.
```typescript
/**
 * The label component is a compact, non-interactive visual element used to
 * categorize content or indicate a status. Its primary role is metadata
 * visualization. While it has similar visual properties to the Chip, it is
 * purely informational and does not trigger actions or allow for removal.
 *
 * @implements ds:global.component.label
 */
@customElement('ds-label')
export default class Label extends LitElement implements LabelProps {
  @property() criticality?: string;
}
```

### Don't

Write custom descriptions that deviate from the DSL.
```typescript
// Bad: Custom title and paraphrased description
/**
 * Label component
 *
 * A compact visual element for status indication.
 */
```

Include `@example` blocks — stories fulfill this role.
```typescript
// Bad: Examples belong in stories, not TSDoc
/**
 * The label component is a compact...
 *
 * @example
 * ```html
 * <ds-label>Default</ds-label>
 * <ds-label criticality="warning">Warning</ds-label>
 * ```
 */
```

Omit the `@implements` tag — it is the link between the component implementation and the DSL definition.
```typescript
// Bad: Missing @implements tag
/**
 * The label component is a compact...
 */
```

---

## Reactive properties typed in types.ts

**Identifier:** `cs:lit.component.types`

Component props (reactive properties/attributes) must be typed in a `types.ts` file and imported into the component implementation. The component class must declare that it `implements` the props interface. Each prop must be documented with a TSDoc comment.

### Do

Define the interface with TSDoc-commented props in `types.ts`.
```typescript
// types.ts
export interface ButtonProps {
  /** The visual emphasis of the button */
  emphasis?: string;
  /** Whether the button is disabled */
  disabled: boolean;
}
```

Import the type and use `implements` in the component class.
```typescript
// Button.ts
import type { ButtonProps } from './types.js';

@customElement('ds-button')
export default class Button extends LitElement implements ButtonProps {
  @property() emphasis?: string;
  @property({ type: Boolean, reflect: true }) disabled = false;
}
```

Use `reflect: true` on boolean props that map to CSS attribute selectors. Without it, the DOM attribute is never written and the CSS selector silently fails.
```typescript
// The CSS rule [disabled] { ... } requires the attribute to exist in the DOM.
// reflect: true ensures setting this.disabled = true also writes disabled="" on the element.
@property({ type: Boolean, reflect: true }) disabled = false;
```

Use the `@implements` JSDoc tag in the component's TSDoc to link to the DSL.
```typescript
/**
 * The button initiates an action...
 *
 * @implements ds:global.component.button
 */
export default class Button extends LitElement implements ButtonProps {}
```

### Don't

Define types inline in the component file — they belong in `types.ts`.
```typescript
// Bad: types belong in types.ts
export default class Button extends LitElement {
  emphasis?: string; // no interface, no types.ts
}
```

Omit the `implements` clause — it enforces that reactive properties stay in sync with the declared interface.
```typescript
// Bad: class doesn't declare it implements the props interface
export default class Button extends LitElement {}
```

---

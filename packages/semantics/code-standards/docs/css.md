# CSS Standards

Standards for css development.

## Scroll-driven animations without JavaScript

**Identifier:** `cs:css.animation.scroll_timeline`

Use scroll-driven animations (`animation-timeline`, `scroll()`, `view()`) instead of scroll-event-driven animation logic. JavaScript scroll animations may be layered on as fallback when needed. See `cs:ui_blocks.principles.scripting_progressive_enhancement`.

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

## One owner per element

**Identifier:** `cs:css.coexistence.territories`

When the design system runs beside Vanilla in one page, every element has exactly one owner. An element carrying `ds`, and everything inside it, is the design system's (`cs:css.selectors.namespace`); everything else is Vanilla's.

What makes the split real is which stylesheets the page loads, not a class on the root. The page loads the Vanilla adapter (`@canonical/styles-vanilla-adapter`) in place of the whole of `@canonical/styles`. The adapter brings its own order statement (`cs:css.layers.order`), an `all: revert` rule in a `boundary` layer that keeps Vanilla's declarations out of `ds` regions, four counters in `vanilla.escapes` for the Vanilla `!important` rules that reach inside one, a confined copy of pragma's element layers (`cs:css.layers.scope`), and a theme bridge in `ds.adapter`. A pragma page and a mixed page carry the same root classes, and `ds` never goes on `<html>` while Vanilla is in the page. Six rules follow.

**No Vanilla markup inside `ds`.** No `p-*`, `u-*`, `l-*` or `is-*` class at any depth, no legacy component, no wrapper that lets Vanilla back in: the boundary reverts it to browser defaults. The one exception is a root that also carries `ds-permeable`: its territory stops at itself, so a layout component such as a grid can arrange Vanilla content. `ds-permeable` only narrows a territory; it never lets Vanilla classes onto a `ds` element.

**One owner per element.** Never a Vanilla class on a `ds` root, never `ds` on Vanilla markup. Wrap instead. The wrapper is required inside a Vanilla container that styles its direct children, such as `.row` or `.p-form--inline`, because a `ds` root placed there loses its placement.

**Inside-out adoption.** Controls first, then groups, then containers, then page shells; a region gets `ds` once nothing Vanilla is left inside it. When nothing Vanilla is left anywhere, the page drops Vanilla and the adapter together and loads `@canonical/styles` whole. Nothing in the markup changes.

**No transform between authoring and the browser.** The boundary and the confined copy are written as they run; the copy is bound to the source by a test, not produced by a build step. If a prefixing pass or a rewrite seems needed, something is outside its territory.

**One source of truth for theme.** While both systems run, Vanilla's mode classes decide light or dark (`cs:css.themes.activation`). The bridge derives pragma's `color-scheme` at each outermost `ds` root from them, and a `light` or `dark` class on a `ds` root inside the page has no effect. A region that needs its own mode declares `color-scheme` from `app`.

**Never `!important` to settle a fight between the two** (`cs:css.declarations.important`): with Vanilla in the lowest layer, its important declarations already beat everything above them.

### Do

The adapter's boundary: one revert rule above Vanilla's layer, stopped at a `ds-permeable` root's children, and one bridge that derives the scheme from Vanilla's theme.
```css
/* abridged: the shipped file also lists the WebKit and Gecko form parts */
@layer boundary {
  @scope (.ds) to (:scope.ds-permeable > *, .ds-permeable > *) {
    :where(:scope, :scope *):where(:not(svg, svg *), svg a),
    :where(:scope, :scope *):where(:not(svg, svg *), svg a)::before,
    :where(:scope, :scope *):where(:not(svg, svg *), svg a)::after,
    :where(:scope, :scope *)::placeholder {
      all: revert;
    }
  }
}

@layer ds.adapter {
  :where(.ds:not(.ds *)) {
    color-scheme: var(--vf-theme-light, light) var(--vf-theme-dark, dark);
  }
}
```

Wrap a root placed in a Vanilla container, let Vanilla's classes decide the theme, and mark a layout root that arranges Vanilla content `ds-permeable`.
```html
<html class="site comfortable light">
  <body class="is-dark">
    <div class="row">
      <div class="col-6">
        <div class="ds card">…</div>
      </div>
    </div>

    <div class="ds grid ds-permeable">
      <div class="col-6 p-card">…Vanilla, unchanged…</div>
      <div class="ds card">…an ordinary pragma component…</div>
    </div>
  </body>
</html>
```

### Don't

Mix the two systems on one element, put Vanilla markup inside a region, drop a root straight into a container that styles its children, or theme a root from pragma's classes.
```html
<!-- Bad: two owners on one element; the Vanilla classes will not apply -->
<div class="ds card p-card--highlighted u-no-margin--bottom">…</div>

<!-- Bad: Vanilla markup inside the region renders with browser defaults -->
<div class="ds card">
  <form class="p-form">…</form>
</div>

<!-- Bad: a root placed directly in a container that styles its children
     loses its placement; wrap it instead -->
<div class="row">
  <div class="ds card col-6">…</div>
</div>

<!-- Bad: a pragma theme class on a root inside a Vanilla page has no
     effect; Vanilla's mode classes decide -->
<div class="ds card dark">…</div>

<!-- Bad: `ds` on the document root makes the whole page an island, and the
     boundary reverts every Vanilla rule in it -->
<html class="ds site comfortable light">
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

## Components own the box of their natives

**Identifier:** `cs:css.component.native_box`

A component that renders a native element owns that element's box and declares it, instead of inheriting whatever the browser or the host page happens to give it.

For a form control — `input`, `button`, `select`, `textarea` — that means `margin: 0`, the padding, and the width policy, plus `::placeholder` wherever the component renders a text input. Replaced elements (`img`, `video`, `iframe`, `canvas`) are sized in CSS, never left to `width` and `height` attributes alone. Table cells are padded in CSS, never by the table's `cellpadding` hint.

Two reasons. Native elements carry browser defaults and presentational attributes that differ between engines, so a component that declares only its own decoration renders differently in each. And inside a design-system subtree sharing a page with a legacy framework, the boundary rolls every declaration from outside back to the browser default (`cs:css.coexistence.territories`), which also rolls back presentational attributes: an attribute-sized image there measures its intrinsic size, or nothing at all while it loads. A component that declares the box renders the same on both pages.

The declarations go in the component's own stylesheet, scoped to its root as `cs:css.component.encapsulation` requires, with tokens for the design decisions (`cs:css.properties.values`).

### Do

Declare the native's box: margin, padding, width policy, placeholder, and the size of anything replaced.
```css
@layer ds.components.global {
  .ds.input {
    & > input {
      margin: 0;
      padding: var(--input-padding);
      inline-size: 100%;

      &::placeholder {
        color: var(--input-placeholder-color);
      }
    }
  }

  .ds.avatar > img {
    inline-size: var(--avatar-size);
    block-size: var(--avatar-size);
  }

  .ds.table :is(th, td) {
    padding: var(--table-cell-padding);
  }
}
```

### Don't

Decorate the native and leave its box to the browser, the host page, or the markup's attributes.
```css
@layer ds.components.global {
  /* Bad: no margin, no padding, no width policy, no ::placeholder — the input
     keeps whatever the page gave it, and inside a design-system subtree on a
     legacy page it keeps nothing at all */
  .ds.input > input {
    border: 1px solid var(--input-border-color);
  }

  /* Bad: sized only by the width and height attributes in the markup, which
     the boundary rolls back with everything else */
  .ds.avatar > img {
    border-radius: 50%;
  }

  /* Bad: padded only by the table's cellpadding hint */
  .ds.table :is(th, td) {
    text-align: start;
  }
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

## No !important

**Identifier:** `cs:css.declarations.important`

No declaration carries `!important`.

Layers decide who wins (`cs:css.layers.order`), and for an important declaration the layer order reverses: the earliest layer wins, and an unlayered important declaration loses to a layered one. So an `!important` in the lowest layer beats every layer above it, and one declaration inverts the whole arrangement instead of settling one rule. It is also unanswerable — the only reply to an important declaration is another one, in a layer lower still.

When a rule does not win, the fix is the layer it sits in, not a louder declaration. When the fight is between selectors inside one layer, `cs:css.selectors.specificity` applies. When it is between a component and something a host page ships, the boundary of `cs:css.coexistence.territories` applies.

The one exception is the Vanilla adapter's four counters, in `vanilla.escapes`. Vanilla ships important rules that reach inside a `ds` region, and only an important declaration from a lower layer can answer one.

### Do

Let the layer settle it; the declaration does not have to shout.
```css
/* ds.components.apps sits above ds.components.global, so this wins on order */
@layer ds.components.apps {
  .ds.button.primary {
    background: var(--button-primary-background);
  }
}
```

### Don't

Use `!important` to win. It inverts the layer order: the lowest layer now beats every layer above it.
```css
/* Bad: normalize is the lowest layer in pragma's own statement, so this
   background now beats ds.components, ds.states and everything an
   application writes */
@layer normalize {
  .ds.button {
    background: var(--button-primary-background) !important;
  }
}
```

---

## No package-level resets

**Identifier:** `cs:css.declarations.package_reset`

A package does not reset elements it does not own.

A rule such as `* { margin: 0; padding: 0 }` written inside a package's own component layer still reaches every element on the page, including another package's components. Layers decide which of two rules that match the same element wins; they cannot narrow what a selector matches. So the tier layers (`cs:css.layers.components`) work exactly as designed and hand the reset the win: a higher tier is meant to beat a lower one, and a universal selector has claimed every element, so it beats the lower tier's components as well as its own. There is nothing the lower tier can do about it, because the argument the tier machinery exists to arbitrate — which of us owns this element — was never had.

Measured: a design-system package's tier-layer reset flattened a global-tier component's 16px padding to zero as soon as both packages were loaded.

What a package does instead is declare what its own components need, on its own components (`cs:css.component.encapsulation`), including the boxes of the native elements they render (`cs:css.component.native_box`). Where a lower tier's component has to differ inside this package, name that component: the tier layer is already the override, and naming it is what makes the override reviewable.

This one is stated and deliberately not enforced by a check. Telling a reset from a legitimate universal rule needs a judgement a test cannot make — the design system's own reset layer is universal on purpose, and the same selector in a package's component layer is not — and the cost of breaking the rule is visible on the first page that loads both packages, so it does not need a gate to be found.

### Do

Declare what your own components need, on your own components, and name the one you mean to override.
```css
@layer ds.components.apps {
  /* this package's own component, and the elements inside it */
  .ds.data-grid {
    margin: 0;

    & > .cell {
      padding: var(--data-grid-cell-padding);
    }
  }

  /* a lower tier's component, where it has to differ here. The tier layer
     is already the override; naming the component is what makes it
     reviewable, and keeps it off everything else on the page */
  .ds.button {
    padding: var(--data-grid-button-padding);
  }
}
```

### Don't

Reset elements the package does not own. The tier that was meant to arbitrate the argument hands the reset the win instead.
```css
@layer ds.components.apps {
  /* Bad: matches every element on the page. This tier beats the global
     tier, as it should for its own components — so it also flattens every
     other package's. Measured: a global-tier component's 16px padding
     computed 0 as soon as both packages were loaded */
  * {
    margin: 0;
    padding: 0;
  }

  /* Bad: the same defect with a smaller blast radius — every list on the
     page, including the ones inside another package's components */
  ul,
  ol {
    margin: 0;
    padding: 0;
  }
}
```

---

## Component styles in ds.components

**Identifier:** `cs:css.layers.components`

Component layers follow the design system's tier tree, one layer per tier, and they are flat: `ds.components` and then one segment naming the tier. The order statement (`cs:css.layers.order`) names the second level in full: `ds.components.global`, `ds.components.sites`, `ds.components.documentation`, `ds.components.stores`, `ds.components.apps`. A package in one of those tiers wraps its stylesheets in its tier's layer and does nothing else.

The segment is the tier's id, not the context class a page puts on its root. `app`, `site` and `docs` are context classes (`cs:css.selectors.reserved_names`); `apps`, `sites` and `documentation` are tiers.

A package below the second level, such as one application's own tier, writes its CSS entry in two steps: name its own flat layer (`@layer ds.components.apps-lxd;`), then import its stylesheets. The order statement comes from the application loading `@canonical/styles` first. The package's name is new, so it is appended after the statement's names inside `ds.components`, where it sorts above every tier. Nothing central has to list it.

The name is flat, `ds.components.apps-lxd` and not `ds.components.apps.lxd`. A rule written directly into a layer sits in that layer's implicit final sublayer, above every sublayer it names, so under a nested name the `apps` tier's own rules would beat the deeper tier. Flat names make the two siblings, and the deeper one is named later.

Three rules close it off. Nothing is written directly into `ds.components`, for the same reason: every rule in it belongs to a tier. A component stylesheet is never unlayered (`cs:css.layers.membership`). And a component never escalates its selector to win against another component: the tier decides, and `cs:css.selectors.specificity` fixes the selector shape.

### Do

Wrap the component's stylesheet in the layer for its tier, which the statement has already placed.
```css
/* packages/react/ds-global/src/ui/Button/styles.css */
@layer ds.components.global {
  .ds.button {
    padding: var(--button-padding);
    background: var(--button-background);
  }
}
```

Below the second level, the package's entry names its own layer, then imports its stylesheets.
```css
/* the CSS entry of an application's own component package */

/* 1. name your layer */
@layer ds.components.apps-lxd;

/* 2. then import your stylesheets, each wrapped in that layer */
@import url("./Button/styles.css");
@import url("./Card/styles.css");
```

### Don't

Nest a sub-tier name, or write into the parent layer. Both lose to the layer that should have lost to them.
```css
/* Bad: nested, so the parent's own rules — which sit in its implicit final
   sublayer, above every sublayer it names — beat the deeper tier */
@layer ds.components.apps {
  .ds.button { padding: var(--button-padding); }
}
@layer ds.components.apps.lxd {
  .ds.button { padding: var(--button-padding-compact); }  /* loses */
}

/* Bad: written straight into ds.components, so it lands in that layer's
   implicit final sublayer — above every tier, and unanswerable from any */
@layer ds.components {
  .ds.button.primary {
    padding: var(--button-padding);
  }
}
```

Escalate a selector to beat another component when the tier already decides it.
```css
/* Bad: ds.components.apps already beats ds.components.global, so the extra
   selectors buy nothing and break the shape every component shares */
@layer ds.components.apps {
  html body .ds.button.primary {
    padding: var(--button-padding-compact);
  }
}
```

---

## Every rule in a named layer

**Identifier:** `cs:css.layers.membership`

Every rule a package or an application ships sits inside a named cascade layer (`@layer`). A normal declaration in an unlayered rule beats the same declaration in every layer, whatever its specificity, so one rule left outside a layer outranks the whole system, and no layer order can bring it back. (An important declaration is no safer: see `cs:css.declarations.important`.)

Among at-rules, only `@font-face` stays outside a layer. It registers a font name rather than styling an element, and each face is declared once, so no layer has anything to order it against. `@keyframes` go inside the layer, beside the rules that use them. `@property` is not exempt either: pragma ships no registration, and a package that ships one puts it in its layer, because layers do order two registrations of the same name. `@charset`, `@import` and the order statement (`cs:css.layers.order`) come before any layer block by definition.

Three things are exempt on purpose:

- Lit components' stylesheets. They apply inside a shadow root, where the document's layers do not reach, and they are deliberately not layered.
- Debug overlays (`@canonical/styles-debug`). They are deliberately unlayered, because an overlay must win over every layered rule.
- `@font-face`, as above.

Which layer a rule goes in, and in what order, is fixed by the order statement (`cs:css.layers.order`); component stylesheets have a rule of their own (`cs:css.layers.components`). A third-party stylesheet that cannot be edited is layered at its import, `@import url("…") layer(lib)`, never by wrapping the import in an `@layer` block: an `@import` after a rule is dropped, and the stylesheet disappears with no error.

### Do

Layer everything a page loads: the design system brings its own layers, a library goes in `lib`, the application's CSS in `app`.
```css
@import url("@canonical/styles");
@import url("@canonical/styles/fonts");               /* @font-face only */
@import url("./vendor/table-tool.css") layer(lib);    /* a library you cannot edit */

@layer app {
  .report-summary {
    padding: var(--spacing-vertical-medium);
  }
}
```

Put `@keyframes` inside the layer, beside the rule that uses them.
```css
@layer ds.components.global {
  @keyframes ds-spinner-rotate {
    to { transform: rotate(360deg); }
  }

  .ds.spinner {
    animation: ds-spinner-rotate var(--spinner-duration) linear infinite;
  }
}
```

### Don't

Leave a rule unlayered. It beats every layered rule that sets the same property on the same element, whatever the order statement says.
```css
/* Bad: unlayered, so this padding wins and the layered rule below never
   applies — no reordering of the layers can change that */
.report-summary {
  padding: 0;
}

@layer app {
  .report-summary {
    padding: var(--spacing-vertical-medium);
  }
}
```

---

## One layer statement, first

**Identifier:** `cs:css.layers.order`

One `@layer` statement fixes the order of every layer, and it is the first rule the browser sees. Layer order is settled by first appearance: a layer that first appears in whichever file loads earliest takes a position nobody chose, and a later statement can add names but never reorder the ones that exist.

Pragma's statement lives in `@canonical/styles/layers.css`, and every entry of `@canonical/styles` imports it first. Lowest first: `normalize, ds.tokens, ds.reset, ds.typography, ds.modifiers, ds.surfaces, ds.states, ds.components, ds.components.global, ds.components.sites, ds.components.documentation, ds.components.stores, ds.components.apps, lib, app`. The later a layer is named, the higher it sits.

`app` and `lib` are the only layer names outside `normalize` and `ds.*`, and both have fixed places at the top: `lib` for a library outside the design system, such as documentation tooling, and `app` above it for an application's own CSS. Nothing else opens a top-level layer of its own.

An application's entry imports `@canonical/styles` first, before anything that imports a component, so that the statement is the first thing the browser reads. The application then writes its CSS in `@layer app`, which the statement has already placed; it does not restate the order.

A sublayer whose position matters is named in the statement, never left to whichever file opens it first. That is why all five component tiers are there. The one name appended later on purpose is a sub-tier package's own flat layer, which sorts above the tiers because the statement was read first (`cs:css.layers.components`).

On a page that also runs Vanilla, the Vanilla adapter's statement comes first instead. It is pragma's list with four names of its own: `vanilla.escapes`, `vanilla` and `boundary` below `normalize`, and `ds.adapter` between `ds.states` and `ds.components` (`cs:css.coexistence.territories`). Pragma's statement, read after it, adds nothing.

### Do

Pragma's statement, the first rule the browser sees. It lives in `@canonical/styles/layers.css`.
```css
@layer normalize,
  ds.tokens,
  ds.reset,
  ds.typography,
  ds.modifiers,
  ds.surfaces,
  ds.states,
  ds.components,
  ds.components.global,
  ds.components.sites,
  ds.components.documentation,
  ds.components.stores,
  ds.components.apps,
  lib,
  app;
```

In an application, import `@canonical/styles` first, then put the application's CSS in `@layer app`.
```typescript
// src/client/entry.tsx — the stylesheet before any component import
import "./styles/index.css"; // @import url("@canonical/styles") is its first import
import { App } from "./App.js";

/* src/styles/app.css — no statement of its own:
   @layer app {
     .app-shell { padding-inline: var(--grid-gap); }
   }
*/
```

On a page that also runs Vanilla, the adapter's statement comes first.
```css
@layer vanilla.escapes,
  vanilla,
  boundary,
  normalize,
  ds.tokens,
  ds.reset,
  ds.typography,
  ds.modifiers,
  ds.surfaces,
  ds.states,
  ds.adapter,
  ds.components,
  ds.components.global,
  ds.components.sites,
  ds.components.documentation,
  ds.components.stores,
  ds.components.apps,
  lib,
  app;
```

### Don't

Import a component before the stylesheet: the component's layer comes first and takes the lowest position.
```typescript
// Bad: App imports components, whose layers the browser now reads before
// pragma's statement
import { App } from "./App.js";
import "./styles/index.css";
```

Open a top-level layer the statement does not name, leave a second-level tier to first appearance, or write a second statement to reorder.
```css
/* Bad: only `lib` and `app` exist outside normalize and ds.* */
@layer vendor {
  .chart { color: var(--color-text); }
}

/* Bad: a second-level tier the statement does not name. It sorts after
   every tier the statement named, in an order nobody chose */
@layer ds.components.marketing {
  .ds.card { padding: var(--card-padding); }
}

/* Bad: a later statement can add layers, never reorder the ones that exist */
@layer ds.components, ds.tokens;
```

---

## Element layers plain; the adapter confines them

**Identifier:** `cs:css.layers.scope`

The three layers that style bare elements — `normalize`, `ds.reset` and `ds.typography` — are written plain in the design system's own stylesheet: ordinary element selectors, no `@scope`, no marker class. They style the whole page because the stylesheet is loaded. Nothing on the document root turns them on or off.

The confinement a page that also runs Vanilla needs lives only in the Vanilla adapter. Its `elements.css` is a copy of those three layers, rule for rule, with each layer's rules wrapped in `@scope (.ds) to (:scope.ds-permeable > *, .ds-permeable > *)`, so they reach only the elements carrying `ds` and what is inside them. A mixed page loads that copy instead of pragma's `elements.css`. A test in the adapter binds the copy to pragma's source, so the two cannot drift. `@scope` therefore appears only in the adapter, and its browser floor binds mixed pages only.

Three things change when a rule is copied into the scope. A scoped selector never matches its own root, so the source's `html` rule names `:scope` in the copy, qualified as `:where(:scope:not(.ds *))`: every component carries `ds` and is a scoping root of its own, and a bare `:scope` would put the baseline on every one of them. The one rule with universal reach, border-box sizing, stays outside the scope block as `:where(.ds, .ds *)`, because a scoped universal rule costs a scope check on every element of the page. And `:where()` keeps every root selector at zero specificity, so a single class in a higher layer overrides it.

The layers that hold custom properties need no copy: a custom property does nothing until a rule reads it, and the rules that read one match a design-system class. Component stylesheets need none either: their selectors carry `.ds` (`cs:css.selectors.namespace`).

### Do

Write pragma's element layers plain: element selectors, no scope, nothing about any host.
```css
/* packages/styles/main/src/reset.css */
@layer ds.reset {
  :where(html:not(pre, code, kbd, samp)) {
    font-family: var(--typography-text-primary-font-family);
  }

  *,
  ::before,
  ::after {
    box-sizing: border-box;
  }
}
```

Confine only in the adapter's copy, and bind the copy to the source with a test.
```css
/* packages/styles/vanilla-adapter/src/elements.css */
@layer ds.reset {
  @scope (.ds) to (:scope.ds-permeable > *, .ds-permeable > *) {
    /* the outermost island root only; nested components inherit from it */
    :where(:scope:not(.ds *, pre, code, kbd, samp)) {
      font-family: var(--typography-text-primary-font-family);
    }
  }

  /* universal reach stays outside the scope block: same match set, same
     specificity, same layer, without a scope check on every element */
  :where(.ds, .ds *),
  :where(.ds, .ds *)::before,
  :where(.ds, .ds *)::after {
    box-sizing: border-box;
  }
}
```

### Don't

Put `@scope` in pragma's own stylesheet, or a marker class on the document root.
```css
/* Bad: every page that loads pragma now pays @scope's browser floor for a
   problem only a mixed page has */
@layer ds.reset {
  @scope (.ds) {
    :where(:scope) { color: var(--color-text); }
  }
}

/* Bad: a class on the root that switches the reset. Which stylesheet a page
   loads is the decision; `ds` is never a root class */
@layer ds.reset {
  html.ds :where(*) { box-sizing: border-box; }
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

Prefer CSS anchor positioning (`anchor-name`, `position-anchor`, `anchor()`, and `position-try`) for tethered elements such as popovers, tooltips, and menus. Start from a resilient baseline and layer anchor positioning; JavaScript positioning libraries may be used as fallback when needed. See `cs:ui_blocks.principles.scripting_progressive_enhancement`.

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

## Read a guaranteed value bare

**Identifier:** `cs:css.properties.fallbacks`

A value the composition always declares is read bare: `var(--color-text)`, not `var(--color-text, #111)`. One place declares it, and every reader reads it without a fallback.

A fallback in a reader is a second declaration of the value, written in a file that does not own it. It is also invisible: nothing in the page tells you a fallback is the value in play. So when the declaration is renamed, moved or fails to load, the page does not break in a way anybody notices — it renders, slightly wrong, at whatever each reader privately believed the value to be. And because each reader carries its own copy, the copies drift: the fallbacks are updated one at a time, or not at all, and the value that was meant to have one source now has several.

Reading it bare gives the opposite failure. Remove the declaration and the property is invalid at computed-value time, the declaration it feeds is dropped, and the element renders visibly unstyled — which is the behaviour that gets the mistake fixed instead of shipped. Tokens follow the same rule they always did (`cs:css.properties.values`): the token is the source, and a raw value beside it is not a safety net but a fork.

The exception is a file that can be loaded on its own, outside the composition — a fixture, an engine a consumer may link by itself, a single sheet taken out of the package. Such a file cannot rely on the declaration, and it says so in its header: which values it reads and does not declare, and what a page that loads it alone has to declare itself. A stated dependency is one a reader can act on; a private default hidden in every `var()` is one nobody can see.

### Do

One place declares the value; every reader reads it bare.
```css
@layer ds.tokens {
  :root {
    --color-text: light-dark(#111, #eee);
  }
}

@layer ds.reset {
  :where(html) {
    color: var(--color-text);
  }
}
```

A file that can be loaded outside the composition states what it reads, in its header, instead of carrying private defaults.
```css
/* baseline-cap.css — the default typographic engine.
 *
 * Linkable on its own, outside the composition. It READS and does not
 * declare: --baseline-height, --font-size, --line-height. A page that links
 * this file without the design system's token layer has to declare them
 * itself; every var() below is bare on purpose, so that a missing one shows
 * up as an element that renders unstyled rather than one that renders
 * slightly wrong.
 */
```

### Don't

Give a reader its own fallback for a value the composition declares. It is a second source of truth, and an invisible one.
```css
@layer ds.reset {
  :where(html) {
    /* Bad: rename or drop --color-text and nothing breaks — the page just
       renders in a colour this file invented. Every other reader has its
       own version of that colour, and they drift apart one edit at a time */
    color: var(--color-text, #111);
  }
}
```

---

## Design tokens over raw values

**Identifier:** `cs:css.properties.values`

CSS properties must use design tokens for design decisions (see `cs:styling.tokens.creation`) and raw values for properties that are independent from design decisions, or "unthemable.

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

## Reserved class names

**Identifier:** `cs:css.selectors.reserved_names`

Nineteen bare class names belong to the design system on any element, and an application must not use any of them for anything else.

Six declare properties on the element that carries them, so putting one on an element of your own changes how that element renders, today:

- `p`, `code` — the typography classes, which set the font family, weight and letter spacing of their carrier
- `light`, `dark` — the theme classes, which set `color-scheme`
- `grid`, `subgrid` — the layout presets, which set `display` and the grid template

The other thirteen declare nothing on their carrier. They set custom properties that only the design system's own rules read, their declarations target descendants, or they change which elements a rule selects rather than what it declares:

- `ds` — the component and territory marker (`cs:css.selectors.namespace`). The design system's own stylesheet never targets it alone: component rules compound with it, as `.ds.button`. On a page that also runs Vanilla, the adapter takes it as the root of a region, so a stray `ds` there opens a region that reverts Vanilla and declares the baseline on itself (`cs:css.coexistence.territories`)
- `app`, `site`, `docs` — the context classes, and `comfortable`, `dense` — the density classes: custom properties only
- `surface`, `contrasted`, `modal` — the surfaces: custom properties only, which the components inside them read
- `editorial` — a typography class whose rules all target descendants
- `responsive`, `intrinsic` — layout presets that set custom properties only, which `grid` reads
- `content-flow` — a layout preset whose one declaration targets the carrier's last child

The reservation is the same for both groups, and it does not rest on what a name does today: the design system may reassign the meaning of any of these names at any release. A class that sets only custom properties in one release can set declarations in the next; a class that styles a child today can style its carrier tomorrow. An application that gives one of them its own meaning has not chosen a name — it has agreed to a merge conflict with a stylesheet it does not control, on a date it does not pick. Name application classes for what they are (`cs:css.selectors.semantics`); the design system will not take a name that describes an application's own domain.

None of the nineteen is a marker a document root has to carry, and `ds` never goes there. A page declares its context, its density and optionally its theme on the root and nothing else, whether or not it also runs another framework, because confinement is a matter of which stylesheet it loads (`cs:css.coexistence.territories`).

Checked on 2026-09-01 against Vanilla Framework's SCSS and the three consumers' templates: none of the seventeen names then listed appears there as a bare class selector, and `responsive` and `intrinsic` do not appear in Vanilla's SCSS either. One appears in a compound — `small.dense` and `.p-text--small.dense` (`vanilla-framework/scss/_base_typography.scss:73`) — so `<small class="dense">` is Vanilla markup that also carries pragma's density modifier. It is harmless today, because pragma's `dense` is in the group that sets custom properties only and nothing outside pragma territory reads them; it is recorded here rather than left to be discovered.

### Do

Use the reserved names only for what the design system means by them, and name your own classes for your own domain.
```html
<html class="app comfortable light">
  <body>
    <section class="surface content-flow">
      <span class="p">Reads as a paragraph, on any element.</span>
      <div class="report-filters">…</div>
    </section>
  </body>
</html>
```

### Don't

Reuse a reserved name for an application's own purpose. The design system owns what it means and may change what it does at any release.
```html
<!-- Bad: all three are the design system's on any element. `grid` and `dark`
     restyle these elements today; `dense` sets custom properties the design
     system's rules read, and may restyle them at the next release -->
<ul class="grid">…</ul>
<table class="dense">…</table>
<button class="dark">…</button>
```

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

Theme tokens must be activated through CSS classes on container elements. See `cs:styling.themes.definition` for theme token structure.

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

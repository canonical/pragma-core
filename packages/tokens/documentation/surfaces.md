# Surfaces

Surfaces are the visual layers of a UI. A page has a background. A card
sits on top of that background. A panel inside the card sits on top of
the card. Each of these is a **surface** -- and the design system
provides layer-aware tokens so that components inside each surface
automatically get the correct colours.

## Quick start

Add the `.surface` class to any container that establishes a new visual
layer:

```html
<body class="surface">
  <!-- Layer 1: page surface -->

  <div class="card surface">
    <!-- Layer 2: elevated surface (tinted background) -->

    <div class="panel surface">
      <!-- Layer 3: nested surface (returns to base background) -->
    </div>
  </div>
</body>
```

That is the entire consumer API. No layer numbers, no configuration.

## How it works

The design system generates a CSS file (`modifiers.surfaces.css`) that
uses **compound descendant selectors** to track depth automatically:

```css
@layer ds.surfaces {
  .surface              { /* depth 1: base semantic values       */ }
  .surface .surface     { /* depth 2: layer2 token values        */ }
  .surface .surface .surface { /* depth 3: layer3 token values (cap) */ }
}
```

Each `.surface` selector sets a family of **surface channel variables**
(`--surface-color-background`, `--surface-color-foreground-ghost`, etc.)
that point to the appropriate layer-specific semantic tokens. Components
consume these through fallback chains that the build system generates.

### Depth compounding

When you nest `.surface` elements, the CSS specificity of descendant
selectors determines which layer applies:

| Nesting depth | CSS match | Layer | Background |
|---------------|-----------|-------|------------|
| 1 `.surface` | `.surface` | 1 | Same as root (white / gray-990) |
| 2 `.surface .surface` | `.surface .surface` | 2 | Tinted (gray-20 / gray-960) |
| 3+ `.surface .surface .surface` | `.surface .surface .surface` | 3 | Returns to root values (capped) |

No counters, no JavaScript, no data attributes. Pure CSS inheritance.

### The fallback chain

Components never reference surface tokens directly. Instead, the state
and modifier systems use fallback chains:

```css
/* Generated in states.css — you do not write this */
var(--surface-color-foreground-ghost, var(--color-foreground-ghost))
```

- **Inside a `.surface`**: `--surface-color-foreground-ghost` is set by
  the surface layer. The first branch wins.
- **Outside any `.surface`**: `--surface-color-foreground-ghost` is
  unset. The fallback resolves to the base semantic token.

This means components work correctly both inside and outside surfaces
with no conditional logic.

## Usage patterns

### Basic: page with a card

```html
<body class="surface">
  <main>
    <h1>Page title</h1>
    <p>Content on the base surface.</p>

    <div class="card surface">
      <h2>Card title</h2>
      <p>Content on layer 2 — slightly tinted background.</p>
    </div>
  </main>
</body>
```

### Nested surfaces

```html
<body class="surface">
  <aside class="sidebar surface">
    <!-- Layer 2: sidebar has tinted background -->

    <nav class="nav-panel surface">
      <!-- Layer 3: navigation panel returns to root-like background -->
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </aside>

  <main>
    <!-- Still layer 1 — main content is not inside a nested .surface -->
    <p>Main content area.</p>
  </main>
</body>
```

### Passthrough containers

If a container should **not** advance the surface layer, simply do not
add `.surface`:

```html
<body class="surface">
  <div class="card surface">
    <!-- Layer 2 -->

    <section class="full-bleed">
      <!-- No .surface class — inherits layer 2 via CSS custom properties -->
      <p>This content stays at layer 2.</p>

      <div class="inner-card surface">
        <!-- Layer 3 — compounding continues from layer 2 -->
      </div>
    </section>
  </div>
</body>
```

Custom property inheritance does the work. No extra classes needed.

### Forms inside surfaces

Form controls (inputs, checkboxes, radios, switches) automatically
receive the correct foreground colours for their surface layer:

```html
<body class="surface">
  <div class="card surface">
    <!-- Layer 2: input foreground colours adjust for tinted background -->
    <label>
      Email
      <input type="email" />
    </label>

    <label>
      <input type="checkbox" /> Accept terms
    </label>
  </div>
</body>
```

The 15 surface channel variables cover all interactive element roles:

| Channel variable | Purpose |
|-----------------|---------|
| `--surface-color-background` | Background fill for the surface area |
| `--surface-color-foreground-ghost` | Ghost-style interactive elements |
| `--surface-color-foreground-ghost-branded` | Branded ghost variant |
| `--surface-color-foreground-ghost-constructive` | Constructive ghost variant |
| `--surface-color-foreground-ghost-destructive` | Destructive ghost variant |
| `--surface-color-foreground-input` | Form input foreground |
| `--surface-color-foreground-input-error` | Input error state foreground |
| `--surface-color-foreground-input-success` | Input success state foreground |
| `--surface-color-foreground-input-warning` | Input warning state foreground |
| `--surface-color-foreground-navigation-primary` | Primary navigation foreground |
| `--surface-color-foreground-checkbox-checkmark` | Checkbox checkmark glyph |
| `--surface-color-foreground-checkbox-unselected` | Unselected checkbox border/fill |
| `--surface-color-foreground-radio-checkmark` | Radio button inner dot |
| `--surface-color-foreground-radio-unselected` | Unselected radio border |
| `--surface-color-foreground-switch-knob` | Toggle switch knob |

## Design rationale

### Why not explicit layer classes?

An earlier version used `.layer2` and `.layer3` class selectors.
Consumers had to know their absolute layer depth and apply the right
class. This broke composability -- moving a card from the root to inside
another card required changing its class.

With `.surface`, the component always says "I am a surface" and the
system resolves the correct layer from context.

### Why does layer 1 look the same as the root?

Layer 1 (`.surface`) sets the surface channel variables to the same
values as the base semantic tokens on `:root`. Visually, layer 1 is
identical to the root.

This serves two purposes:

1. **Structural marker.** `.surface` on `<body>` establishes the
   surface context. Children compound from depth 1 automatically.

2. **Design flexibility.** Layer 1 values matching root is a current
   design choice. If the design team later wants layer 1 to have a
   subtle visual distinction, the token file is already in place and
   no consumer code changes.

### Why not set surface variables on `:root`?

The fallback chain `var(--surface-color-X, var(--color-X))` already
handles the "no surface" case correctly. Setting `--surface-*` on
`:root` would:

- Globally populate the surface channel, making the fallback branch
  unreachable. This makes debugging harder (you can't tell whether a
  surface is active or not in devtools).
- Couple the theme layer (`ds.modifiers`) with the surface layer
  (`ds.surfaces`) on the same selector, muddying the cascade boundary.

### Why cap at 3 levels?

The token palette oscillates: layer 2 is tinted, layer 3 returns to
root values. Deeper nesting repeats this pattern. Three levels cover
all realistic UI hierarchies. If cycling is needed in the future, the
system can be extended without changing the consumer API.

## CSS cascade position

Surface declarations live in the `@layer ds.surfaces` cascade layer:

```
@layer ds.tokens;      /* primitives, semantic tokens */
@layer ds.modifiers;   /* theme, typography, colour-intent modifiers */
@layer ds.surfaces;    /* surface depth compounding */
@layer ds.states;      /* hover, active, disabled derivations */
```

Surfaces override modifiers but are overridden by interaction states.

## Token architecture (for contributors)

Surface tokens are defined as modifier files in the resolver:

```
tokens/canonical/global/semantic/modifier/surface/
├── layer1.tokens.json   → aliases to base semantic tokens
├── layer2.tokens.json   → aliases to -layer2 semantic tokens
└── layer3.tokens.json   → aliases to -layer3 semantic tokens
```

Each file uses the `com.canonical.modifier` extension with `aliasOf` to
reference the appropriate semantic token:

```json
{
  "color": {
    "background": {
      "$extensions": {
        "com.canonical.modifier": {
          "aliasOf": "color.background.layer2"
        }
      }
    }
  }
}
```

The resolver configuration maps these to surface contexts:

```json
{
  "surface": {
    "contexts": {
      "none": [],
      "layer1": [{ "$ref": ".../layer1.tokens.json" }],
      "layer2": [{ "$ref": ".../layer2.tokens.json" }],
      "layer3": [{ "$ref": ".../layer3.tokens.json" }]
    }
  }
}
```

The plugin maps resolver context names to compound CSS selectors:

```
layer1 → .surface
layer2 → .surface .surface
layer3 → .surface .surface .surface
```

This mapping is defined in `SURFACE_SELECTOR_MAP` in the plugin source.
Token files and CSS variable names (e.g., `--color-background-layer2`)
remain unchanged -- only the CSS selector output changes.

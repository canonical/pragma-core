# The default modifier

Every modifier family with colour channels now ships a `default` value:
anticipation, criticality, emphasis, lifecycle and release. It exists to
opt a block out of a modifier context it has been nested inside.

## The problem it solves

A modifier class on an ancestor sets channel variables
(`--modifier-color-text`, `--modifier-color-border`, ...) that inherit
down the DOM. A component reads a channel through a fallback:

```css
.ds.chip {
  color: var(--modifier-color-text, var(--chip-color-text));
}
```

The fallback branch only runs when **no ancestor** set the channel. So a
chip with no criticality of its own, nested inside a card marked
`.error`, renders error-tinted: the chip inherits the card's channel and
never reaches its own token. For a component that states one attribute
of an object, that inherited colour is wrong — it says something the
component did not say.

Neutral, until now, meant *absence of the class*. There was no way to
say "neutral" in the presence of an ancestor that already said
otherwise.

## The mechanism

The generated family stylesheet carries a `.default` class that rebinds
every channel the family emits back to its own base semantic token:

```css
@layer ds.modifiers {
  .error {
    --modifier-color-text: var(--color-text-error);
    /* ... */
  }
  .default {
    --modifier-color-text: var(--color-text);
    --modifier-color-border: var(--color-border);
    /* ... every channel the family emits ... */
  }
}
```

A custom property declared **on the element itself** beats the value
inherited from an ancestor, by the CSS custom-property cascade. So an
element wearing `.default` reads its own neutral tokens instead of
falling through to whatever the nearest modifier ancestor set:

```html
<div class="card error">
  <span class="chip">tinted — inherits the card's error channel</span>
  <span class="chip default">neutral — the element's own binding wins</span>
</div>
```

Nesting still composes: an explicit `.error` on the element (or a closer
ancestor) overrides `.default` by the same rule — the closest
declaration wins.

## Consumer API

The class is applied exactly like any other modifier value. For a
component whose modifier prop maps to a class:

```jsx
<Chip criticality="error" />  // error-tinted
<Chip criticality="default" /> // neutral, whatever the ancestors say
<Chip />                        // inherits the ancestor context, if any
```

`default` is an **opt-in** value, never the implicit one. A component
that receives no modifier keeps inheriting the modifier context of its
ancestors — that cascading is the intended composition mechanism, and
the `default` value exists precisely for the cases where it is not
wanted.

Three behaviours follow, and they are the acceptance criteria:

- `criticality="error"` inside an `.error` card: error (the element's
  own class wins).
- `criticality="default"` inside an `.error` card: neutral (the
  element's own binding beats the inherited channel).
- no criticality inside an `.error` card: inherits the error context.

## What the build does

`default` is not a token file. The token graph cannot express it: the
generated family CSS is a diff of each context against the base
resolution, and a neutral overlay is identical to the base — it would
diff to nothing. Instead the resolver declares `default` as a context
with no sources, and the plugin synthesizes the class after the diff
pass: it takes every channel the family's real contexts emitted and
rebinds it to the same-named base token. The rule is emitted into the
family's own `modifiers.<family>.css`, inside `@layer ds.modifiers`,
after the context rules.

Because the channel set is derived from what the family emits, the
`.default` rule needs no maintenance when a family gains or loses a
channel.

A family whose contexts emit no channels (importance today) emits no
`.default` rule — there is nothing to rebind. Families outside the
scope — surface, theme, product, typography, spacing, breakpoint,
density — are structural rather than colour-intent and take no `default`
context.

## Interaction with the rest of the system

- **States.** `states.css` derives hover / active / disabled channels per
  element from `var(--modifier-color-X, ...)`. On an element wearing
  `.default` the modifier branch resolves to the neutral token, so the
  state colours are neutral too — no separate reset needed.
- **Shims.** Channels that live only in `@canonical/styles` shims (the
  criticality icon glyph, the camelCase on-foreground-secondary text
  channel) are not part of the generated set and are reset by the
  shim itself, beside its own classes.
- **Surfaces.** Surface channels sit above modifiers in the layer order
  and are unaffected: `.default` rebinds modifier channels only.

## Where it is declared

- Resolver: `default` context (empty source list) on the five families.
- Plugin: `buildModifierFamily` synthesizes the `.default` rule.
- Knowledge graph: one `ds:global.modifier.default` entity, member of
  the five families.

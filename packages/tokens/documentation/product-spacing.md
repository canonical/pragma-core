# Product baseline and component spacing

The public component-spacing API contains twelve semantic dimension tokens.
They are emitted by `dist/modifiers.spacing.css`; their primitive aliases are
emitted by `dist/sets.primitive.css`.

The unscoped `:root` spacing values are the Site defaults. The `.site`,
`.docs`, `.app`, and `.os` product selectors restate the complete spacing
matrix so a nested product scope resets every spacing value at equal
specificity. Typography resolves independently: the unscoped typography set
is global, and the pre-existing typography builder omits an `.os` block when
its values equal that global set.

| Token | CSS custom property | Site / `:root` | Docs | App | OS |
| --- | --- | ---: | ---: | ---: | ---: |
| `spacing.baseline` | `--spacing-baseline` | `0.5rem` | `0.25rem` | `0.25rem` | `0.25rem` |
| `spacing.gap.field.block` | `--spacing-gap-field-block` | `0.5rem` | `0.5rem` | `0.5rem` | `0.25rem` |
| `spacing.gap.mark.inline` | `--spacing-gap-mark-inline` | `0.5rem` | `0.5rem` | `0.25rem` | `0.25rem` |
| `spacing.gap.group.block` | `--spacing-gap-group-block` | `1.5rem` | `1.5rem` | `0.5rem` | `1.5rem` |
| `spacing.gap.pattern.block` | `--spacing-gap-pattern-block` | `4rem` | `3rem` | `1rem` | `3rem` |
| `spacing.gap.region.block` | `--spacing-gap-region-block` | `8rem` | `6rem` | `2rem` | `6rem` |
| `spacing.inset.field.inline` | `--spacing-inset-field-inline` | `0.5rem` | `0.5rem` | `0.25rem` | `0.25rem` |
| `spacing.inset.action.inline` | `--spacing-inset-action-inline` | `1rem` | `0.75rem` | `0.75rem` | `0.5rem` |
| `spacing.inset.continuation.inline` | `--spacing-inset-continuation-inline` | `2rem` | `1.5rem` | `1.5rem` | `1.25rem` |
| `spacing.inset.surface.inline` | `--spacing-inset-surface-inline` | `1rem` | `1rem` | `0.75rem` | `0.5rem` |
| `spacing.inset.surface.block` | `--spacing-inset-surface-block` | `1rem` | `1rem` | `0.75rem` | `0.5rem` |
| `spacing.inset.strip.block` | `--spacing-inset-strip-block` | `4rem` | `3rem` | `3rem` | `2rem` |

Token names describe ownership and relationship rather than magnitude. Inline
values alias primitive dimensions directly; they are not derived from the
vertical baseline or typography metrics.

## Line-height lattice

The build validates every resolved semantic typography line height against the
resolved product baseline using its exact `lineHeightDimension`. Whole baseline
counts pass. A half count passes only for an exact product/token member in
`packages/tokens/contracts/lineHeightExceptions.json`; comparisons use exact
rational arithmetic with no epsilon and values are never rounded or snapped.

The only current exception is the five-member Site
`typography.text.secondary` family at `5/2` baselines (14px type on 20px
leading). Its manifest records both the accepted single-line half-phase exit
and multiline phase alternation. Site display remains 84px on 96px leading,
exactly 12 Site baselines.

The former breakpoint-owned `dimension.size.height.baseline` is retired.
`spacing.baseline` is the only baseline token.

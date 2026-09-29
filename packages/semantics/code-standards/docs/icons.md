# Icons Standards

Standards for icons development.

## Semantic kebab-case filenames

**Identifier:** `cs:icons.file.naming`

Icon files must:
- Use kebab-case naming
- Use semantic identifiers

### Do

Use kebab-case and a semantic identifier for the icon file name.
```
warning.svg
user-profile.svg
arrow-down.svg
```

### Don't

Include size, theme, or redundant suffixes in the file name.
```
warning-16.svg
warning-dark.svg
warning_icon.svg
WARNING.svg
```

Use non-semantic or ambiguous names that do not describe the icon.
```
icon1.svg
shape.svg
```

---

## One SVG file per icon

**Identifier:** `cs:icons.file.storage`

Each icon shall be stored as a single SVG file in the `icons/` directory.

### Do

Store each icon as an individual SVG file in the designated `icons/` directory.
```
icons/
  ├── warning.svg
  ├── search.svg
  └── github.svg
```

### Don't

Store icons in nested directories or use incorrect file extensions.
```
icons/
  ├── variants/
  │   └── warning-dark.svg
  ├── warning/
  │   └── index.svg
  └── warning.svg.txt
```

Combine multiple icons into a single SVG file.
```
icons/
  └── all-icons.svg
```

---

## Inherit color via currentColor

**Identifier:** `cs:icons.svg.color_usage`

Icon must use `fill` with `currentColor` for their paths and shapes.

### Do

Use `currentColor` for the `fill` of paths in non-branded icons.
```svg
<!-- Non-branded icon -->
<svg viewBox="0 0 16 16">
  <g id="search">
    <path fill="currentColor" d="..." />
  </g>
</svg>
```

### Don't

Use hard-coded colors in icons.
```svg
<path fill="#000000" d="..." />
```

Use `opacity` to create different shades of a color.
```svg
<path fill="currentColor" opacity="0.5" d="..." />
```

---

## Single group with matching ID

**Identifier:** `cs:icons.svg.group_element`

Each icon's SVG markup must contain a single `<g>` element with an `id` matching the filename (without `.svg`).

### Do

Include a single `<g>` element with an `id` that matches the filename.
```svg
<!-- warning.svg -->
<svg>
  <g id="warning">
    <!-- icon paths -->
  </g>
</svg>
```

### Don't

Use multiple `<g>` elements or an `id` that does not match the filename.
```svg
<!-- warning.svg -->
<svg>
  <g id="icon-group">
    <!-- icon paths -->
  </g>
  <g id="warning-alt">
    <!-- alternate paths -->
  </g>
</svg>
```

---

## Masks for cutouts and overlays

**Identifier:** `cs:icons.svg.mask_usage`

Use SVG <mask> elements to create negative space or overlays in icons.
Example

### Do

Use SVG <mask> elements to create negative space or overlays in icons.
Example
```svg
<svg width='16' height='16' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <mask id="error-mask">
      <rect width="16" height="16" fill="white"/>
      <path d="..." fill="black"/>
    </mask>
  </defs>
  <g id="error">
    <circle fill='currentColor' cx='8' cy='8' r='7' mask="url(#error-mask)"/>
  </g>
</svg>
```

Use <rect> with fill="white" to define the mask area, and <path> with fill="black" to subtract shapes.
Example
```svg
<mask id="mask">
  <rect width="16" height="16" fill="white"/>
  <path d="M4 4h8v8H4z" fill="black"/>
</mask>
```

Use opacity on mask paths to achieve partial negation (e.g., faded or semi-transparent cutouts).
Example
```svg
<mask id="progress-mask">
  <rect width="16" height="16" fill="white"/>
  <path d='...' fill="black" opacity=".5"/>
</mask>
```

Reference the mask in the icon's main shape using mask="url(#mask-id)".
Example
```svg
<circle fill='currentColor' cx='8' cy='8' r='7' mask="url(#mask-id)"/>
```

### Don't

Use masks without clear purpose or visual benefit.
Example
```svg
<!-- Bad: Mask used but has no effect -->
<mask id="empty-mask">
  <rect width="16" height="16" fill="white"/>
</mask>
<circle fill='currentColor' cx='8' cy='8' r='7' mask="url(#empty-mask)"/>
```

use non-semantic mask ids or omit mask references in the main shape.
Example
```svg
<!-- Bad: Non-semantic mask id -->
<mask id="123">
  <rect width="16" height="16" fill="white"/>
  <path d="..." fill="black"/>
</mask>
```

rely on masks for simple icons that do not require negative space or overlays.
Example
```svg
<!-- Bad: Mask used for a simple shape -->
<mask id="simple-mask">
  <rect width="16" height="16" fill="white"/>
</mask>
<rect fill='currentColor' x='2' y='2' width='12' height='12' mask="url(#simple-mask)"/>
```

---

## Uniform 16×16 viewBox

**Identifier:** `cs:icons.svg.viewbox`

All icon SVGs must use a `viewBox` of `0 0 16 16`.

### Do

Set the `viewBox` attribute to `0 0 16 16` in the `<svg>` element.
```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
  <g id="icon">
    <!-- Icon content scaled to 16x16 -->
  </g>
</svg>
```

### Don't

Use a `viewBox` with dimensions other than `16 16`.
```svg
<!-- Bad: Different viewBox size -->
<svg viewBox="0 0 24 24">
  <g id="icon">...</g>
</svg>
```

Use a non-square `viewBox`.
```svg
<!-- Bad: Non-square viewBox -->
<svg viewBox="0 0 16 24">
  <g id="icon">...</g>
</svg>
```

Omit the `viewBox` attribute.
```svg
<!-- Bad: Missing viewBox -->
<svg width="16" height="16">
  <g id="icon">...</g>
</svg>
```

---

## Type-safe icon names

**Identifier:** `cs:icons.type_safety.definition`

Icon names must be:
- Maintained in a type-safe constant array
- Used to generate the `IconName` type
- Defined in the icon exporter package

### Do

Define a constant array of icon names and derive the `IconName` type from it in the icon exporter package.
```typescript
// In the icon exporter package
export const ICON_NAMES = [
  "warning",
  "search",
  "github"
] as const;

export type IconName = typeof ICON_NAMES[number];
```

Import the `IconName` type in consumer code to ensure type safety.
```typescript
// In consumer code
import type { IconName } from '@canonical/ds-assets';

export interface ComponentProps {
  icon: IconName;
}
```

Use `Pick` to restrict choices from `IconName` when necessary.
```typescript
// In consumer code
import type { IconName } from '@canonical/ds-assets';

export interface ComponentProps {
  icon: Pick<IconName, "warning" | "search">;
}
```

### Don't

Define icon name types or values on the consumer side.
```typescript
// Bad: String literal type defined in consumer code
type ComponentIconName = "warning" | "search";

export interface ComponentProps {
    icon: ComponentIconName;
}
```

Use a generic `string` type for icon names.
```typescript
// Bad: No type safety for icon names
export interface ComponentProps {
    icon: string;
}
```

Maintain separate type and value definitions.
```typescript
// Bad: Duplication of icon names
const ICONS = ["warning", "search"];
type IconName = "warning" | "search";
```

---

## No size or theme variants

**Identifier:** `cs:icons.variant.single_file`

Each icon concept must have exactly one SVG file. Size and theme variants are not allowed.

### Do

Use a single SVG file for each icon and control its size and color with CSS.
```svg
<!-- Single icon file -->
<svg viewBox="0 0 16 16">
  <g id="warning">
    <path fill="currentColor" d="..." />
  </g>
</svg>

/* CSS usage */
.small-icon { font-size: 1em; } /* 16px */
.large-icon { font-size: 2em; } /* 32px */
.warning-icon { color: var(--color-warning); }
```

### Don't

Create multiple files for different icon sizes.
```
warning.svg
warning-small.svg
warning-large.svg
```

Create multiple files for different themes.
```
warning.svg
warning-dark.svg
warning-light.svg
```

---

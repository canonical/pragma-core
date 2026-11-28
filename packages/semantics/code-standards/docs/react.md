# React Standards

Standards for react development.

## Complete barrel exports

**Identifier:** `cs:react.component.barrel_exports`

The index.ts file must be a complete barrel export for the component folder, re-exporting all public APIs.

### Do

Create an index.ts file that re-exports all public APIs from the component folder.
```typescript
// index.ts
export { default as [MyComponent] } from './[MyComponent].js';
export type * from './types.js';
// If you have multiple components:
export { default as SubComponent } from './SubComponent.js';
```

### Don't

Omit the index.ts file or fail to re-export all public APIs.
```typescript
// Bad: index.ts only exports default, omits types and named exports
export { default } from './[MyComponent].js';
```

Use `export * from './types.js'` as it allows value exports, which is not expected for types files.
```typescript
// Bad: Using export * from './types.js' allows value exports, which is not allowed
export * from './types.js';
```

---

## Class names ordered by specificity

**Identifier:** `cs:react.component.class_name_construction`

Component CSS class names must be constructed following a specific pattern:

1.  Base Class Constant: A `componentCssClassName` constant must be defined at the top of the component file. This constant holds the component's base class name, including the global `ds` scope (e.g., `"ds button"`).
2.  Array Construction: The `className` string must be built from an array of classes.
3.  Class Order: The classes in the array must be ordered from least to most specific to ensure a predictable CSS cascade:
    a. Base Class: The `componentCssClassName` constant.
    b. Modifier Classes: Classes derived from component props (e.g., `emphasis`, `severity`).
    c. Consumer Classes: The `className` prop passed by the consumer.
4.  Filtering and Joining: The array must be processed with `.filter(Boolean).join(" ")` to remove any falsy values (e.g., undefined props, expressions that evaluate to false) and create the final space-delimited string.

### Do

Follow the complete pattern for class name construction.
```tsx
const componentCssClassName = "ds badge";

const Badge = ({
  value,
  className,
  severity,
  ...props
}: BadgeProps): React.ReactElement => {
  return (
    <span
      className={[componentCssClassName, severity, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {value}
    </span>
  );
};
```

### Don't

Hardcode the base class name inside the JSX.
```tsx
// Bad: Base class "ds badge" is hardcoded.
<span className={["ds badge", severity, className].filter(Boolean).join(" ")}>
```

Place the consumer `className` prop before other classes.
```tsx
// Bad: Consumer class is first
<span className={[className, componentCssClassName, severity].filter(Boolean).join(" ")}>
```

Use string concatenation or template literals to add class names.
```tsx
// Bad: Harder to read and maintain, vulnerable to inconsistent formatting
<span className={`${componentCssClassName} ${severity} ${className}`}>
```

---

## Unidirectional component dependencies

**Identifier:** `cs:react.component.dependencies`

Place a subcomponent in its parent's `common/` folder. Imports flow down or sideways, never up to the parent or into another component's `common/`. A subcomponent shared by many components of one package may live in `subcomponent/<Name>/`, attached to one parent.

### Do

Keep a part in its parent's `common/`; put one many components share in `subcomponent/`
```
src/lib/
  ├── component/Card/
  │   ├── Card.tsx
  │   └── common/Header/Header.tsx
  └── subcomponent/Field/
      └── Label/Label.tsx   // used by every *Field, attached as Field.Label
```

### Don't

Import upwards, or from another component's `common/`
```typescript
// Card/common/Header/Header.tsx
import Card from "../../Card.js";
// TextField/TextField.tsx
import Label from "../CheckboxField/common/Label/index.js";
```

---

## File naming by scope

**Identifier:** `cs:react.component.file_naming`

Component folder and file naming is based on scope. Component-specific files (implementation, stories, tests) must be prefixed with the component's name (e.g., `MyComponent.tsx`, `MyComponent.stories.tsx`). Domain-level files that serve the entire folder (e.g., `Context.tsx`, `styles.css`, `types.ts`) should use generic, descriptive names, as the folder already provides the domain context.

### Do

Prefix component-specific files and use generic names for domain-level files.
```
[MyComponent]/
  ├── [MyComponent].tsx           # Component-specific
  ├── [MyComponent].stories.tsx   # Component-specific
  ├── [MyComponent].test.tsx      # Component-specific
  ├── Context.tsx               # Domain-level
  ├── Context.test.tsx          # Domain-level
  ├── types.ts                  # Domain-level
  └── styles.css                # Domain-level
```

### Don't

Add redundant prefixes to domain-level files.
```
[MyComponent]/
  ├── [MyComponent].Context.tsx   # Bad: Redundant prefix
  ├── [MyComponent].types.ts      # Bad: Redundant prefix
  └── [MyComponent].styles.css    # Bad: Redundant prefix
```

---

## Router integration via LinkComponent

**Identifier:** `cs:react.component.link_component`

A *complex* component — one that renders a set of navigable items (a list, tree, tab strip, breadcrumb trail, menu) and injects an inner link renderer for them — MUST integrate with a consumer's router through a single `LinkComponent` prop against the shared `LinkComponentProps` contract, NOT through a per-component re-authored interface and NOT through the polymorphic `as` prop. (A *simple* component that merely re-targets its own wrapper element uses `as` instead — see the boundary below.)

The contract is deliberately narrow: `LinkComponent?: ComponentType<LinkComponentProps> | "a"`, defaulting to the intrinsic `"a"`. `LinkComponentProps` forwards only `href`, `className`, `children`, and `aria-current` — not the full anchor attribute set — so the same router `Link` adapter works across every component that uses it. Define `LinkComponentProps` once in a shared location and import it; do not copy the interface per component.

Boundary with the polymorphic `as` prop — the deciding question is *what is being configured*: the component's own wrapper element, or an inner link renderer among other structure.

- **Simple component → `as`.** When the component IS the element (its own root wrapper is what gets swapped for the consumer's link/element — e.g. a `Link`, `Button`, `Box`, or any single-element component the consumer re-targets), use the polymorphic `as`/`ElementType` prop. The consumer configures the wrapper directly.
- **Complex component → `LinkComponent`.** When the component renders multiple navigable items and injects ONE inner link renderer for each (a list, tree, tab strip, breadcrumb trail, menu), use `LinkComponent`. Here `as` would be wrong: there is no single wrapper to re-target, and threading `as`-style generics through the subcomponents to reach each inner link is the anti-pattern this standard exists to prevent.

Fallback semantics: a non-navigable item (one with no `url`/`href`) MUST render a plain element such as `<span>` — never the injected link, and never a `<button>`. When an item is disabled, its `href` is omitted. Active state drives `aria-current` (e.g. `"page"`) on the rendered link.

Except: a `role="menu"` whose items carry roving focus and menu ARIA renders link items as plain anchors and routes navigation through its select callback.

### Do

Inject the link via a single `LinkComponent` prop typed against the shared `LinkComponentProps`, defaulting to the intrinsic anchor, and render a plain element for non-navigable items.
```typescript
// types.ts — shared contract, defined once and imported (not re-declared per component)
export interface LinkComponentProps {
  href?: string;
  className?: string;
  children?: ReactNode;
  "aria-current"?: HTMLAttributes<HTMLElement>["aria-current"];
}

export interface TabsProps extends HTMLAttributes<HTMLElement> {
  items: NavItem[];
  /** Router integration. Defaults to "a". Pass a router Link (e.g. @canonical/router-react). */
  LinkComponent?: ComponentType<LinkComponentProps> | "a";
}

// Item.tsx — navigable items render through the injected component; others fall back to a span
const Item = ({ url, label, active, disabled, LinkComponent = "a" }: ItemProps) => {
  const Link = LinkComponent;
  return url ? (
    <Link href={disabled ? undefined : url} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  ) : (
    <span aria-current={active ? "page" : undefined}>{label}</span>
  );
};
```

### Don't

Re-author the link contract per component, reach for the polymorphic `as` prop for router integration, or render a link for a non-navigable item.
```typescript
// Bad: a bespoke, wider interface copied into this component instead of the shared LinkComponentProps
interface TabsProps {
  // Bad: `as` on a COMPLEX multi-item component — there is no single wrapper to
  // re-target; the link renderer is inner. Use LinkComponent here. (`as` is for
  // SIMPLE components whose own wrapper element is what gets configured.)
  as?: ElementType;
  items: { href: string }[];
}

const Item = ({ href, active, as: As = "a" }: ItemProps) => (
  // Bad: renders the link even when there is no destination; forwards arbitrary anchor props
  <As href={href} aria-selected={active}>   {/* Bad: aria-selected on a link is non-conformant */}
    {label}
  </As>
);
```

---

## PascalCase component names

**Identifier:** `cs:react.component.naming`

Components must use PascalCase naming and be descriptive of their purpose.

### Do

Use PascalCase and descriptive names for components:
UserProfile
NavigationBar
SearchResultList

### Don't

Use non-PascalCase or unclear names:
userProfile
navigation_bar
searchresultlist

---

## Documented and spreadable props

**Identifier:** `cs:react.component.props`

Component props must:
- Be documented with TSDoc comments
- Be destructured when used in markup
- Be spread to the root element when unused
- Follow type-specific patterns based on what the component renders

### Do

Document props with TSDoc comments and use proper destructuring and spreading.
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button's text content */
  label: string;
  /** Optional icon to display before the label */
  icon?: React.ReactNode;
  /** Visual emphasis of the button */
  emphasis?: ModifierFamily<"emphasis">;
}

const Button = ({
  label,
  icon,
  emphasis,
  className,
  ...props  // Spread unused HTML button props
}: ButtonProps) => (
  <button
    className={[componentCssClassName, emphasis, className].filter(Boolean).join(" ")}
    {...props}
  >
    {icon}
    <span>{label}</span>
  </button>
);
```

### Don't

Mix explicit and spread props or destructure props unnecessarily.
```typescript
// Bad: Mixing explicit props with spread
const Button = (props: ButtonProps) => (
  <button
    className={props.className}
    onClick={props.onClick}  // Should be in ...props
    {...props}              // Now duplicates onClick
  >
    {props.label}
  </button>
);

// Bad: Unnecessarily destructuring HTML props
const Button = ({
  label,
  className,
  onClick,     // Should be in ...props
  onFocus,     // Should be in ...props
  disabled,    // Should be in ...props
  ...props
}: ButtonProps) => (
  <button
    className={className}
    onClick={onClick}     // Explicit when it could be spread
    onFocus={onFocus}    // Explicit when it could be spread
    disabled={disabled}  // Explicit when it could be spread
    {...props}
  >
    {label}
  </button>
);
```

---

## Extend native HTML element props

**Identifier:** `cs:react.component.props.html_rendering`

A component's props type must extend the native props of the element it renders as its root: a design-system-owned `OwnProps` intersected with that tag's `ComponentProps`, with the design-system keys omitted from the native half.

### Do

Intersect the design-system props with the root tag's native props, omitting the DS-owned keys.
```typescript
import type { ComponentProps } from "react";

type OwnProps = {
  /** Visual prominence of the button. */
  importance?: "primary" | "secondary";
};

// Change "button" to whatever element the component actually renders as its root.
export type ButtonProps = OwnProps & Omit<ComponentProps<"button">, keyof OwnProps>;
```

Destructure every DS-owned prop out, spread the rest onto the root, and set DS-controlled attributes after the spread so they win.
```tsx
const Button = ({ importance, className, ...rest }: ButtonProps) => (
  // type is set before the spread, so a caller can still override it;
  // className is merged rather than replaced.
  <button type="button" {...rest} className={["ds", importance, className].filter(Boolean).join(" ")} />
);
```

State any further exclusion the component deliberately controls, and say why.
```typescript
// The design system owns href and tabIndex on this component, so they are
// excluded from the native half rather than left for a caller to set.
export type SkipLinkProps = OwnProps &
  Omit<ComponentProps<"a">, keyof OwnProps | "href" | "tabIndex">;
```

A component with no single native root is exempt — and says so in the file, so a later reader knows it was decided rather than missed. Check first: a component that renders a wrapper element has a root, however composite it looks.
```typescript
/**
 * Internal renderer props — exempt from the native-prop extension convention.
 * This is not a public component and has no single native root the consumer
 * styles: it receives a ready-made ARIA/roving prop bag from the menu hook and
 * spreads that onto its element instead of extending a tag's native props.
 */
export interface ItemProps {
  item: _Item<MenuItem>;
  itemProps: Record<string, unknown>;
}
```

### Don't

Use `interface … extends` for the native half. It does not distribute over unions, so a component with two root forms silently loses its discriminant.
```typescript
// Bad: an interface cannot express the union case, and extending one
// alongside union members can collapse the props to `any`.
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  importance?: "primary" | "secondary";
}
```

Reach for the per-element `XxxHTMLAttributes<T>` interfaces. They are easy to mis-instantiate against an element the component does not render.
```typescript
// Bad: says HTMLDivElement while the component renders a <section>.
// ComponentProps<"section"> cannot be wrong in that way.
export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  spacing?: "tight" | "loose";
}
```

Re-declare attributes the native props already carry — they drift from the DOM and hide which props the design system actually owns.
```typescript
// Bad: every one of these already exists on ComponentProps<"button">.
export interface ButtonProps {
  importance?: "primary" | "secondary";
  id?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}
```

Use `ComponentPropsWithoutRef` on React 19, where `ref` is an ordinary prop and belongs in the surface.
```typescript
// Bad on React 19: drops ref from the public props for no reason.
export type ButtonProps = OwnProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof OwnProps>;
```

Give the design-system half the public name and invent a suffixed one for the finished type. A `Type` suffix carries no information — the position already says it is a type — and it appears when the good name is taken, which is the collision to fix rather than work around.
```typescript
// Bad: a consumer importing ChipProps reasonably expects the props of <Chip>,
// and receives the design-system fields with none of the native ones. The name
// that reads correctly is the one that is wrong.
export interface ChipProps { criticality?: Criticality }
export type ChipPropsType = InteractiveChipProps | StaticChipProps;

// Good: the finished type takes the name, the design-system half is private.
type OwnProps = { criticality?: Criticality };
export type ChipProps = InteractiveChipProps | StaticChipProps;
```

---

## Namespaced props for inner components

**Identifier:** `cs:react.component.props.wrapper`

Wrapper components must use namespaced props for inner components and accept unscoped props for the wrapper element.

### Do

Use namespaced props for inner components and unscoped props for the wrapper element.
```tsx
interface ThumbnailSectionProps extends SectionProps {
  /** Props for the thumbnail image */
  imageProps: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
    alt: string;
  };
}

const ThumbnailSection = ({
  imageProps,
  className,
  ...props
}: ThumbnailSectionProps) => (
  <Section className={[componentCssClassName, className].filter(Boolean).join(" ")} {...props}>
    <img {...imageProps} />
  </Section>
);
```

### Don't

Mix prop scopes between wrapper and inner components.
```tsx
interface ThumbnailSectionProps {
  src: string;      // Bad: Unscoped image props
  alt: string;      // Bad: Unscoped image props
  width: number;    // Bad: Ambiguous - for image or section?
}

const ThumbnailSection = ({ src, alt, width, ...props }: ThumbnailSectionProps) => (
  <Section {...props}>
    <img src={src} alt={alt} width={width} />
  </Section>
);
```

---

## Context provider file structure

**Identifier:** `cs:react.component.structure.context`

Context providers must use `Provider.tsx` as the main component file instead of the standard component naming pattern `[MyComponent].tsx`. Provider prop and return types must be defined in the hook-level types file `hooks/types.ts` with `UseProviderStateProps` (the tuple of the hook's arguments: required provider props by position, optional ones in one `options` object, never `children`) and `UseProviderStateResult` (matching the context options).

### Do

Organize provider-related files by separating concerns into distinct files: place the context definition in `Context.tsx`, the provider implementation in `Provider.tsx`, and provider-specific hooks in a `hooks/` directory. Create a `hooks/useProviderState.ts` file to centrally manage the state of the provider.`
```
[MyComponent]/
  ├── Context.tsx
  ├── Context.test.tsx
  ├── Provider.tsx
  ├── Provider.test.tsx
  ├── index.ts
  ├── types.ts
  └── common/
    └─ [SubComponent]/
        ├── index.ts
        ├── [SubComponent].tsx
        ├── [SubComponent].test.tsx
        └── types.ts
  └── hooks/
      ├── index.ts
      ├── types.ts
      ├── useProviderState.ts
      └── useProviderState.test.ts
```

Create the context type within `types.ts`.
```typescript
// [MyComponent]/types.ts
/** The value of the config context */
export interface ContextOptions {
  /** Whether the baseline grid should be shown */
  showBaselineGrid: boolean;
  /** Toggles the baseline grid's visibility. */
  toggleShowBaselineGrid: () => void;
}
```

create the provider props type within `types.ts`, accepting `children` at a minimum and more props as needed.
```typescript
// [MyComponent]/types.ts

export interface ProviderProps {
    // The child nodes which will have access to the provider state
    children: React.ReactNode;
    // Where the provider keeps its state
    storageKey: string;
    // Whether the grid is shown before the user toggles it
    defaultShown?: boolean;
}
```

Create a `Context.tsx` file for the context definition.
```tsx
// [MyComponent]/Context.tsx
import { createContext } from "react";
import type { ContextOptions } from "./types.js";

const Context = createContext<ContextOptions | undefined>(undefined);

export default Context;
```

Use `Provider.tsx` as the main component file. The provider is responsible for wrapping children with the context.
```tsx
// [MyComponent]/Provider.tsx
import Context from "./Context.js";
import { useProviderState } from "./hooks/index.js";
import type { [MyComponent]Component, ProviderProps } from "./types.js";

const Provider = ({ children, storageKey, defaultShown }: ProviderProps) => {
  const state = useProviderState(storageKey, { defaultShown });
  return <Context.Provider value={state}>{children}</Context.Provider>;
};

export default Provider as [MyComponent]Component;
```

Use `index.ts` to export the `Provider` as a named component that matches the folder name.
```typescript
// [MyComponent]/types.ts
import type { ReactElement } from "react";

export type [MyComponent]Component = ((props: ProviderProps) => ReactElement) & {
  SubComponent: (props: SubComponentProps) => ReactElement | null;
};

// [MyComponent]/index.ts
export { default as [MyComponent] } from "./Provider.js";
```

Create provider state hook types in `hooks/types.ts` for context providers.
```typescript
// [MyComponent]/hooks/types.ts
import type { ContextOptions, ProviderProps } from "../types.js";

// The hook's arguments: required props by position, optional ones in one
// options object. children is only rendered by the provider, never passed.
export type UseProviderStateProps = [
  storageKey: ProviderProps["storageKey"],
  options?: Pick<ProviderProps, "defaultShown">,
];

// The result of the provider state hook. This should match the context options defined in the main component types file.
export type UseProviderStateResult = ContextOptions;
```

Create a provider state hook implementation.
```tsx
// [MyComponent]/hooks/useProviderState.ts
import { useContext } from "react";
import type { UseProviderStateProps, UseProviderStateResult } from "./types.js";

/**
 * Hook to manage the state of the provider
 */
const useProviderState = (
  ...[storageKey, { defaultShown = false } = {}]: UseProviderStateProps
): UseProviderStateResult => {
 // centralize the entire provider state here...
}
```

### Don't

Create a separate component file (e.g., `[MyComponent].tsx`) when `Provider.tsx` exists. The provider is the main component.
```
[MyComponent]/
  ├── [MyComponent].tsx
  └── Provider.tsx
```

Nest context-related files in a `context/` subfolder.
```
[MyComponent]/
  └── context/ # Unnecessary nesting
      ├── Context.tsx
      └── Provider.tsx
```

Create multiple provider files within the same component folder.
```
[MyComponent]/
  ├── Provider.tsx
  └── AnotherProvider.tsx # Only one provider per component
```

Mix concerns of the Provider and its state.
```tsx
exort const Provider = ({ children }: ProviderProps) => {
  const [state, setState] = useState(...); // Bad: State logic mixed in
  return <Context.Provider value={{ state, setState }}>{children}</Context.Provider>;
};
```

---

## One folder per component

**Identifier:** `cs:react.component.structure.folder`

Each component must reside in its own folder, which contains all related files: component implementation, tests, type definitions, and optionally stories and styles. Some components may be styleless or may not have stories; in these cases, styles.css and [MyComponent].stories.tsx are optional. Context providers follow a different structure (see cs:react.component.structure.context).

### Do

Place all component-related files within a single folder named after the component.
```bash
[MyComponent]/
  ├── [MyComponent].tsx
  ├── [MyComponent].stories.tsx
  ├── [MyComponent].test.tsx
  ├── index.ts
  ├── styles.css
  └── types.ts
```

### Don't

Scatter component files across different parts of the application.
```bash
# Bad: Files are not co-located
components/
  ├── [MyComponent].tsx
stories/
  └── [MyComponent].stories.tsx
styles/
  └── [MyComponent].css
```

---

## Public and private subcomponent exports

**Identifier:** `cs:react.component.subcomponent_export_api`

A subcomponent a consumer places as a child is public: attach it to its parent with dot notation (`Card.Header`), one level deep. Never export a subcomponent under its own name from the package root. A subcomponent the parent renders from its props or data stays private.

### Do

Attach a subcomponent the consumer places; keep one the parent renders private
```tsx
// Card.Header is placed by the consumer: public
<Card>
  <Card.Header />
</Card>

// SideNavigation renders its items from data: private
<SideNavigation items={tree} />
```

### Don't

Export a subcomponent flat, or nest one a second level deep
```tsx
// src/index.ts
export { Card, CardHeader } from "./lib/index.js";

<Card>
  <Card.Header>
    <Card.Header.Title />
  </Card.Header>
</Card>
```

---

## Component TSDoc from the ontology

**Identifier:** `cs:react.component.tsdoc`

Component TSDoc documentation must use the description from the design system ontology (DSL). The TSDoc should NOT include @example blocks since stories serve as the examples. The description should be copied verbatim from the DSL, maintaining the original wording and meaning.

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
const Label = ({ children, criticality, className, ...props }: LabelProps) => (
  <span className={[componentCssClassName, criticality, className].filter(Boolean).join(" ")} {...props}>
    {children}
  </span>
);
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

Include @example blocks - stories fulfill this role.
```typescript
// Bad: Examples belong in stories, not TSDoc
/**
 * The label component is a compact...
 *
 * @example
 * <Label>Default</Label>
 * <Label criticality="warning">Warning</Label>
 */
```

Omit the @implements tag that links to the DSL.
```typescript
// Bad: Missing @implements tag
/**
 * The label component is a compact...
 */
```

---

## Import statement in TSDoc

**Identifier:** `cs:react.component.tsdoc.import`

A component's TSDoc gives its consumer import in backticks, on its own line before `@implements`, naming what the package exports; a public subcomponent's line names its parent (`` `import { Card } from "@canonical/react-ds-global";` `` for `Card.Header`). Except: a private subcomponent has none.

### Do

Give the consumer's import on its own line before `@implements`
```typescript
/**
 * The header of a card, holding its title and actions.
 *
 * `import { Card } from "@canonical/react-ds-global";`
 *
 * @implements ds:global.subcomponent.card-header
 */
```

### Don't

Name the local identifier, or give a private subcomponent a line
```typescript
// Bad: the package exports FieldError as Error
/** `import { FieldError } from "@canonical/react-ds-global-form";` */

// Bad: Item, a private subcomponent of SideNavigation
/** `import { SideNavigation } from "@canonical/react-ds-global";` */
```

---

## Single-concern custom hooks

**Identifier:** `cs:react.hooks.custom`

A hook takes its required inputs positionally and its optional ones — any that may be omitted or has a default — in one trailing `options` object. `[HookName]Props` is the tuple of its arguments, in `hooks/types.ts`.

### Do

Pass required inputs by position and optional ones in `options`
```typescript
// hooks/types.ts
export type UseDataViewsValueProps<T, S> = [
  channel: Channel<T>,
  options?: { select?: (value: T) => S; isEqual?: (a: S, b: S) => boolean },
];

useDataViewsValue(channel, { select, isEqual });
useDataViewsFilter(collection, field, { operator });
useLocalized(messages);
```

### Don't

Put a required input in an object, or an optional one by position
```typescript
// Bad: channel is required
useDataViewsValue({ channel, select });

// Bad: disabled is optional
useQueryChip(children, disabled);
```

---

## Descriptive use-prefixed hook names

**Identifier:** `cs:react.hooks.naming`

The hook name must start with 'use' and clearly describe its purpose.

### Do

Name custom hooks so the hook name starts with 'use' and is descriptive
```typescript
useWindowSize()
useAuthentication()
useFormValidation()
```

### Don't

Name hooks without the 'use' prefix at the start of the hook name
```typescript
windowSize()
getAuth()
formValidation()
```

---

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

Component dependencies must follow a strict unidirectional flow:
- Subcomponents must be in a `common/` folder within the parent component's directory
- Dependencies can flow downwards (parent to subcomponent) or sideways (between siblings)
- Dependencies must not flow upwards (subcomponent to parent)

### Do

Place subcomponents in a `common/` folder inside the parent component directory.
```
Card/
  ├── Card.tsx
  ├── common/
  │   ├── Header/
  │   │   └── Header.tsx
  │   ├── Footer/
  │   │   └── Footer.tsx
  │   └── utils/
  │       └── helpers.ts
  └── index.ts
```

Allow subcomponents to depend on siblings or shared utilities within the same component scope.
```typescript
// Header.tsx can import from utils/
import { helper } from '../utils/helpers.js';

// Footer.tsx can import from Header.tsx
import Header from '../Header.js';
```

### Don't

Create dependencies that flow upwards from a subcomponent to its parent.
```typescript
// Bad: Header.tsx in Card/common/ should not import from Card.tsx
import Card from '../../Card.js';
```

Allow external components to depend on the internal structure of another component.
```typescript
// Bad: AnotherComponent should not import from Card's internal common folder
import Header from '../Card/common/Header.js';
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

Use PascalCase and descriptive names for components:
UserProfile
NavigationBar
SearchResultList

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

Components that render HTML markup must extend the base HTML element props interface to enable passing native properties through spreading.

### Do

Extend the appropriate React HTML props interface and add component-specific props.
```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button label */
  label: string;
}
```

### Don't

Manually redefine standard HTML attributes that are already available through the base interface.
```typescript
export interface ButtonProps {
  /** The button label */
  label: string;
  onClick?: () => void;    // Bad: Duplicates HTML button props
  disabled?: boolean;      // Bad: Duplicates HTML button props
}
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

Context providers must use `Provider.tsx` as the main component file instead of the standard component naming pattern `[MyComponent].tsx`. Provider prop and return types must be defined in the hook-level types file `hooks/types.ts` with `UseProviderStateProps` (containing all `ProviderProps` minus `children`) and `UseProviderStateResult` (matching the context options).

### Do

Organize provider-related files by separating concerns into distinct files: place the context definition in `Context.tsx`, the provider implementation in `Provider.tsx`, and provider-specific hooks in a `hooks/` directory. Create a `hooks/useProviderState.ts` file to centrally manage the state of the provider.`
```
[MyComponent]/
  ├── Context.tsx
  ├── Provider.tsx
  ├── index.ts
  ├── types.ts
  └── common/
    └─ [SubComponent]/
        ├── index.ts
        ├── [SubComponent].tsx
        └── types.ts
  └── hooks/
      ├── index.ts
      ├── types.ts
      └── useProviderState.ts
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
    // ...other props...
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
import { useProviderState } from "./hooks/useProviderState.js";
import type { ProviderProps } from "./types.js";

const Provider = ({ children }: ProviderProps) => {
  const state = useProviderState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
};

export default Provider;
```

Use `index.ts` to export the `Provider` as a named component that matches the folder name, casting it to the component type.
```typescript
// [MyComponent]/types.ts
import type { ReactElement } from "react";

export type [MyComponent]Component = ((props: ProviderProps) => ReactElement) & {
  SubComponent: (props: SubComponentProps) => ReactElement | null;
};

// [MyComponent]/index.ts
import Provider from "./Provider.js";
import type { [MyComponent] } from "./types.js";

export const [MyComponent] = Provider as [MyComponent]Component;
export default [MyComponent];
```

Create provider state hook types in `hooks/types.ts` for context providers.
```typescript
// [MyComponent]/hooks/types.ts
import type { ContextOptions, ProviderProps } from "../types.js";

// The props expected by the provider state hook. The children prop is omitted, as it is not passed to the hook - it is only rendered by the provider component.
export type UseProviderStateProps = Omit<ProviderProps, "children">;

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
const useProviderState = ({
    // ..props...
}: UseProviderStateProps): UseProviderStateResult => {
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

Subcomponents are **public** if they are intended to be directly used by the consumer of the parent component to construct a UI.

Subcomponents are **private** if they are internal implementation details of the parent component, and are not intended for direct use by the consumer.

Public subcomponents must be:
- Exported by attaching them to the parent component using dot notation.
- Named semantically.
- Kept to a single level of nesting.

Private subcomponents must remain internal to the component's implementation and not be exported by any file.

### Do

Export public subcomponents by attaching them to the parent component using dot notation
```typescript
const Item = (props: ItemProps) => { /* ... */ };
const Accordion = (props: AccordionProps) => { /* ... */ };
Accordion.Item = Item;
export default Accordion;
```

Use semantic, self-descriptive names for subcomponents
```typescript
Accordion.Item
Card.Header
Card.Footer
```

Keep subcomponent nesting to a single level
```typescript
<Card>
  <Card.Header />
  <Card.Footer />
</Card>
```

### Don't

Repeat the parent component name in subcomponent names
```typescript
Card.CardHeader = Header; // Bad: Redundant 'Card' prefix
```

Map a subcomponent to a different name (renaming)
```typescript
Card.Top = Header; // Bad: Mapping 'Header' to 'Top' is not allowed
```

Use non-semantic or unclear subcomponent names
```
Card/
  └── common/
      ├── Part/           # Bad: Too vague, not semantic - what part?
      ├── Element/        # Bad: Too vague, not semantic - what element?
```

Nest subcomponents more than one level deep
```typescript
<Card>
  <Card.Header>
    <Card.Header.Title />
  </Card.Header>
</Card>
```

Export private subcomponents that are not intended for public use.
```typescript
// Bad: Exporting internal-only subcomponents
export { InternalHelper };
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

A component's TSDoc must show how a consumer imports it: a single import statement wrapped in backticks, on its own line, with a blank line before it, placed just before the @implements tag. This documents the public import surface without an @example block (which cs:react.component.tsdoc forbids). The imported name must match the component's exact public export API — the identifier a consumer actually imports from the package's published name — which is not always the local declaration name (a component may be renamed at its barrel, e.g. a local `FieldError` re-exported as `Error`).

### Do

Add the backtick-wrapped import line before @implements.
```typescript
/**
 * The label component is a compact, non-interactive visual element used to
 * categorize content or indicate a status.
 *
 * `import { Label } from \"@canonical/react-ds-global\";`
 *
 * @implements ds:global.component.label
 */
```

### Don't

Use an @example or a fenced code block instead of the single backtick line.
```typescript
// Bad: @example is forbidden; a fenced block is heavier than needed
/**
 * The label component is a compact...
 *
 * @example
 * import { Label } from \"@canonical/react-ds-global\";
 */
```

Omit the blank line before the import, or drop the backticks.
```typescript
// Bad: no blank line before, and no backticks
/**
 * The label component is a compact...
 * import { Label } from \"@canonical/react-ds-global\";
 * @implements ds:global.component.label
 */
```

Use the local declaration name when the barrel re-exports it under a different name.
```typescript
// The component is declared locally as FieldError but exported as `Error`.
// Bad: imports the local name, which the consumer cannot import
/**
 * `import { FieldError } from \"@canonical/react-ds-global-form\";`
 */
// Good: use the exported (consumer-facing) name
/**
 * `import { Error } from \"@canonical/react-ds-global-form\";`
 */
```

---

## Single-concern custom hooks

**Identifier:** `cs:react.hooks.custom`

Custom hooks must separate concerns at the domain level. All hooks within a ComponentDomain/hooks directory are considered within the domain scope and should focus on a single concern. Custom hooks must be used when:
    - Logic needs to be shared between components
    - Component logic becomes complex
    - State management needs to be abstracted
    - Side effects need to be encapsulated

All of the types for a domain level's hooks must be defined in the `hooks/types.ts` file of that folder.
Each hook must define a [HookName]Props and [HookName]Result type in `hooks/types.ts`.

### Do

Create a custom hook that focuses on a single concern within the domain.
```typescript
// [MyComponent]/hooks/useWindowFitment.ts
const useWindowFitment = ({
  onBestPositionChange,
  autoFit = false,
}: UseWindowFitmentProps): UseWindowFitmentResult => {
```

Create hook types in `hooks/types.ts`.
```typescript
// [MyComponent]/hooks/types.ts
export interface UseWindowFitmentProps {
  /**
   * Whether the popup should automatically fit into the viewport.
   * If true, the hook will try to fit the popup into the viewport if it doesn't fit in the preferred directions.
   * Defaults to false.
   */
  autoFit?: boolean;
  /**
   * An optional callback to be called when the best position of the popup changes.
   */
  onBestPositionChange?: (bestPosition?: BestPosition) => void;
}

export interface UseWindowFitmentResult {
  /**
   * A ref to be attached to the target element.
   */
  targetRef: RefObject<HTMLDivElement | null>;
  /**
   * A ref to be attached to the popup element.
   */
  popupRef: RefObject<HTMLDivElement | null>;
  /**
   * The calculated best possible position of the popup element.
   */
  bestPosition?: BestPosition;
  /**
   * The style object to be applied to the popup element.
   */
  popupPositionStyle: CSSProperties;
}
```

### Don't

Create a custom hook for simple, non-reusable state.
```tsx
// Bad: Unnecessary abstraction for a simple counter
const useCounter = () => {
  const [count, setCount] = useState(0);
  return { count, setCount };
};
```

Mix multiple concerns in a single hook
```typescript
// Bad: Multiple concerns in one hook
const useUserData = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState({});
  const [notifications, setNotifications] = useState([]);
  return { isAuthenticated, profile, settings, notifications };
};
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

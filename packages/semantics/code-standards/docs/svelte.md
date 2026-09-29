# Svelte Standards

Standards for svelte development.

## Explain every $effect

**Identifier:** `cs:svelte.component.effect-descriptions`

Add a clear comment immediately above every `$effect` that states the side effect, the trigger or dependency intent, and why the effect is needed, so reviewers can validate correctness without reverse-engineering the effect body.

### Do

(Do) Place a comment directly above the `$effect` that explains the side effect, what should trigger it, and why it is needed.
```javascript
// Sync document title when pageTitle changes to keep browser context and accessibility cues up to date
$effect(() => {
  document.title = `${pageTitle} | Canonical`;
});
```

### Don't

(Don't) Use `$effect` without a comment.
```javascript
$effect(() => {
  document.title = `${pageTitle} | Canonical`;
});
```

---

## Native attribute names for props

**Identifier:** `cs:svelte.component.native-prop-naming`

Name consumer-facing props with Svelte's native attribute names (for example `class`, `onclick`, `onchange`). Do not use React-style names such as `className` or `onClick`: Svelte forwards native attributes under these names. When a native-named prop is declared manually rather than inherited from `SvelteHTMLElements` — for example because it targets a different element than the forwarded rest attributes — keep the native name and the native type (`ClassValue` from `svelte/elements` for `class`), and document which element it applies to.

### Do

(Do) Accept the native `class` prop, aliasing it locally only to avoid the reserved word. When it targets a different element than the forwarded rest attributes, declare it manually with the native `ClassValue` type and document its target.
```svelte
<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  interface ItemProps extends Omit<SvelteHTMLElements["a"], "class"> {
    current?: boolean;
    /** CSS class applied to this item's `<li>`, in addition to the base classes. */
    class?: ClassValue;
  }

  const componentCssClassName = "ds breadcrumbs-item";
  let { current = false, class: className, children, ...rest }: ItemProps = $props();
</script>

<li class={[componentCssClassName, className]} class:current>
  <a {...rest}>{@render children?.()}</a>
</li>
```

### Don't

(Don't) Expose React-style `className` or `onClick` props.
```svelte
<script lang="ts">
  let { current = false, className, onClick }: ItemProps = $props();
</script>

<li class={["ds breadcrumbs-item", className]} class:current onclick={onClick}></li>
```

---

## Framework-agnostic components

**Identifier:** `cs:svelte.component.purity`

Keep components framework-agnostic: receive all render data and behavior through props, emits, and callbacks, and do not import SvelteKit runtime modules (for example `$app/stores`, `$app/navigation`, or `$app/environment`) inside reusable UI components.

### Do

(Do) Pass data via props instead of importing from SvelteKit modules.
```svelte
<script>
  let { pageTitle } = $props();
</script>

<h1>{pageTitle}</h1>
```

### Don't

(Don't) Import from SvelteKit modules like `$app/stores`, `$app/navigation`, or `$app/environment`.
```svelte
<script>
  import { page } from '$app/stores';
</script>

<h1>{$page.data.title}</h1>
```

---

## Naming refs by reactivity role

**Identifier:** `cs:svelte.component.reference-naming`

Name element references by reactivity role: use the `Ref` suffix for reactive references that participate in Svelte tracking (such as `bind:this`) and the `Element` suffix for non-reactive DOM lookups, so usage semantics are explicit at call sites.

### Do

(Do) Name reactive references (e.g., via `bind:this`) with the `Ref` suffix.
(Do) Name non-reactive references (e.g., via `querySelector`) with the `Element` suffix.
```svelte
<script>
  let containerRef = $state();

  $effect(() => {
    const headerElement = containerRef?.querySelector('h1');
  });
</script>

<div bind:this={containerRef}>
  <h1>Title</h1>
</div>
```

### Don't

(Don't) Use generic or ambiguous names for element references.
```svelte
<script>
  let container = $state();

  $effect(() => {
    const header = container.querySelector('h1');
  });
</script>

<div bind:this={container}>
  <h1>Title</h1>
</div>
```

---

## Call use functions at top level

**Identifier:** `cs:svelte.component.use-call-sites`

Call `use…` functions only at top-level component scope. Do not invoke them inside handlers, conditionals, loops, or nested functions.

### Do

(Do) Call `use…` functions at the top-level scope of the `<script>` block.
```svelte
<script>
  const stopwatch = useStopwatch();

  function handleStart() {
    stopwatch.start();
  }
</script>

<button onclick={handleStart}>Start</button>
```

### Don't

(Don't) Call `use…` functions inside event handlers, conditionals, loops, or nested scopes.
```svelte
<script>
  function handleClick() {
    const stopwatch = useStopwatch();
    stopwatch.start();
  }
</script>

<button onclick={handleClick}>Start</button>
```

---

## Reserve the use prefix for runes

**Identifier:** `cs:svelte.component.use-naming`

Reserve the `use…` prefix for functions that relay on internal runes definitions (e.g., `$state`, `$derived`, `$effect`) or capture lifecycle-bound behavior (e.g, `onMount`).

### Do

(Do) Use the `use…` prefix only for functions with reactive or lifecycle behavior.
```svelte
<script>
  const stopwatch = useStopwatch();
</script>
```

(Do) Use non-`use…` names for plain utilities.
```javascript
const formatted = formatDate(new Date());
```

### Don't

(Don't) Name plain helpers with the `use…` prefix.
```javascript
function useFormatDate(date) {
  return date.toISOString();
}
```

---

## Name attachments by behavior

**Identifier:** `cs:svelte.composition.attachment-naming`

Name functions used with `{@attach ...}` according to observable behavior or intent (for example tooltip, focusTrap, observeHover), so call sites communicate what is being attached; avoid generic names that hide purpose.

### Do

(Do) Use verbs or nouns that describe the attachment's behavior (e.g., `tooltip`, `observeHover`).
```svelte
<button {@attach tooltip("Save changes")}>
  Save
</button>
```

### Don't

(Don't) Use vague or generic names like `handler` or `myAttachment`.
```svelte
<button {@attach handler(someData)}>
  Save
</button>
```

---

## Native composition over component injection

**Identifier:** `cs:svelte.composition.customization`

Offer customization through Svelte-native composition — native attribute spreading, subcomponents, snippets, `{@attach}`, and `setContext` — instead of injecting a component. When an override escape hatch is genuinely needed, expose a typed snippet with a spreadable props object. See cs:svelte.composition.snippet-attributes.

### Do

(Do) Let consumers customize by spreading native attributes onto the element (extend the native element type).
```svelte
<script lang="ts">
  import type { SvelteHTMLElements } from "svelte/elements";
  type Props = SvelteHTMLElements["a"] & { active?: boolean };
  let { active = false, class: className, ...rest }: Props = $props();
</script>

<a class={["ds item", className]} class:active aria-current={active ? "page" : undefined} {...rest}></a>
```

(Do) When an override hook is needed, expose a typed snippet whose props object is fully typed and spreadable.
```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  type RenderProps = { href: string; "aria-current": "page" | undefined };
  let { href, active = false, children }: { href: string; active?: boolean; children?: Snippet<[RenderProps]> } = $props();
  const renderProps: RenderProps = { href, "aria-current": active ? "page" : undefined };
</script>

{#if children}
  {@render children(renderProps)}
{:else}
  <a {...renderProps}></a>
{/if}
```

### Don't

(Don't) Accept an injected component (React-style) for overrides, especially typed as `Component<any>`, which hides the injected props from the type system and narrows the element contract.
```typescript
export interface Props {
  Component: Component<any>;
  active?: boolean;
}
```
```svelte
<script lang="ts">
  let { Component, href, active = false }: Props = $props();
</script>

<!-- Injected props (href, aria-current) are invisible to Component's type -->
<Component {href} aria-current={active ? "page" : undefined} />
```

---

## Pass accessors across reactive boundaries

**Identifier:** `cs:svelte.composition.reactivity-boundaries`

When reactive state crosses object or function boundaries, pass accessors (property getters or `get…` functions) instead of raw values so downstream code reads current state and preserves reactive tracking across reassignments.

### Do

(Do) Use property getters when working with objects (e.g., in `setContext`).
```typescript
let greeting = $state("Hello");

setContext('my-context', {
  get greeting() {
    return greeting;
  }
});
```
(Do) Use getter functions (prefixed with `get…`) when passing state to functions like `use…` hooks.
```typescript
// useStorage.ts
export function useStorage(getGreeting: () => string) {
  $effect(() => {
    localStorage.setItem('greeting', getGreeting());
  });
}

// MyComponent.svelte
useStorage(() => greeting);
```

### Don't

(Don't) Pass raw reactive values directly to objects or functions where tracking might be lost.
```typescript
// Object property - reactivity lost on reassignment
setContext('my-context', { greeting });

// Function argument - value is not reactive inside $effect
useStorage(greeting);
```

---

## Spreadable attribute objects for snippets

**Identifier:** `cs:svelte.composition.snippet-attributes`

When rendering snippets that require consumer wiring, pass a descriptively named attributes object (for example `triggerProps`) that can be spread directly onto an element; do not pass positional attribute fragments or omit required wiring data.

### Do

(Do) Provide a `triggerProps` (or similarly named) object for spreading onto target elements.
```svelte
{@render trigger({
  popovertarget: popoverId,
  "aria-describedby": helpId
})}

<MyComponent>
  {#snippet trigger(triggerProps)}
     <button {...triggerProps}>
       Open Popover
     </button>
  {/snippet}
</MyComponent>
```

### Don't

(Don't) Pass individual HTML attributes as positional snippet arguments, which prevents consumers from spreading props and forces them to know both argument order and intended usage.
```svelte
{@render trigger(popoverId, helpId)}

<!-- Usage -->
<MyComponent>
  {#snippet trigger(popoverId, helpId)}
     <button
       popovertarget={popoverId}
       aria-describedby={helpId}
     >
       Open Popover
     </button>
  {/snippet}
</MyComponent>
```

(Don't) Render snippets without providing necessary attributes, forcing consumers to manually wire up internal IDs.
```svelte
{@render trigger()}

<MyComponent>
  {#snippet trigger()}
     <button popovertarget="hardcoded-id">
       Open Popover
     </button>
  {/snippet}
</MyComponent>
```

---

## Choosing snippets or subcomponents

**Identifier:** `cs:svelte.composition.snippets-vs-subcomponents`

Use snippets to let consumers provide and position render content (default `children` plus named regions), and use subcomponents when behavior, state coordination, or styling contracts must be encapsulated; do not replace structured content slots with flattened string or object props.

### Do

(Do) Pass primary content via the default `children` snippet.
(Do) Use named snippets for multiple, distinct areas.
```svelte
<Card>
  {#snippet header()}
    <h3>Title</h3>
  {/snippet}

  <p>Main content using children snippet.</p>
</Card>
```
(Do) Use subcomponents to encapsulate specific behaviors and styles.

### Don't

(Don't) Pass complex content or UI structures via props instead of snippets.
```svelte
<Card
  header="Title"
  body="Main content"
/>
```

---

## Stable IDs with a fallback

**Identifier:** `cs:svelte.composition.stable-ids`

When wiring element relationships, resolve a stable ID by defaulting to `$props.id()` fallback if no consumer id is provided.

### Do

(Do) Resolve a stable ID by combining an optional `id` prop with a fallback.
```typescript
const { id: idProp, ...rest } = $props();
const fallbackId = $props.id();
const id = $derived(idProp || fallbackId);
```

### Don't

(Don't) Fail to provide a fallback ID, breaking accessibility and internal wiring when the `id` prop is omitted.
```typescript
// No fallback if id is not provided
const { id, ...rest } = $props();
```

---

## Expose structured subcomponents

**Identifier:** `cs:svelte.composition.subcomponents`

When a component contains repeated items or non-trivial layout composition, expose structured subcomponents (for example group, item, and action primitives) so consumers own iteration, markup order, and semantic HTML. Avoid hiding these decisions behind configuration props.

### Do

(Do) Expose constituent parts as subcomponents to give consumers control over HTML.
```svelte
<OptionsPanel>
  <form action="?/updateProfile" method="POST">
    <OptionsPanel.Group title="Profile">
      {#each groups[0].options as option}
        <OptionsPanel.Option
          name="profile-field"
          value={option.value}
          aria-label={option.label}
        >
          {option.label}
        </OptionsPanel.Option>
      {/each}
    </OptionsPanel.Group>
    <OptionsPanel.SubmitButton>Save</OptionsPanel.SubmitButton>
  </form>
</OptionsPanel>
```

### Don't

(Don't) Hide complex UI structures or iteration logic behind simple configuration props.
```svelte
<OptionsPanel {groups} submitLabel="Save" />
```

---

## Defer browser globals to the client

**Identifier:** `cs:svelte.progressive-enhancement.ssr-runtime-access`

Avoid accessing browser-only globals (`window`, `document`, `navigator`, `localStorage`, and similar APIs) at module scope or component initialization scope. Access them only in client-only execution points such as `$effect`, event handlers, or after mount.

### Do

(Do) Access browser APIs inside `$effect` so code only runs on the client.
```svelte
<script>
  let width = $state(0);

  $effect(() => {
    width = window.innerWidth;
  });
</script>
```

(Do) Access browser APIs in event handlers if needed.
```svelte
<script>
  function copyUrl() {
    navigator.clipboard.writeText(window.location.href);
  }
</script>

<button onclick={copyUrl}>Copy URL</button>
```

### Don't

(Don't) Read browser globals at module or component initialization scope.
```svelte
<script>
  const initialWidth = window.innerWidth;
  const userAgent = navigator.userAgent;
</script>
```

---

## Named snippet fixture modules

**Identifier:** `cs:svelte.testing.snippet-fixtures`

When testing a component that renders consumer-provided snippet content (`children` or named snippets), define reusable fixtures in a `.svelte` fixture module (for example `test.fixtures.svelte`). Declare the content as named snippets in a `<script lang="ts" module>` block and export them alongside the plain data each snippet renders.

### Do

(Do) Export named snippets and their backing data from a `.svelte` fixture module.
```svelte
<!-- test.fixtures.svelte -->
<script lang="ts" module>
  import Item from "./Item.svelte";

  export const oneItemProps = { id: 1, label: "First" } as const;
  export const itemsProps = [
    { id: 1, label: "First" },
    { id: 2, label: "Second" },
  ] as const;

  export { oneItem, items };
</script>

{#snippet oneItem()}
  <Item {...oneItemProps} />
{/snippet}

{#snippet items()}
  {#each itemsProps as { label, ...rest } (rest.id)}
    <Item {...rest}>{label}</Item>
  {/each}
{/snippet}
```

(Do) Import the snippets as snippet props and assert against the exported data.
```typescript
import { render } from "vitest-browser-svelte";
import Component from "./Component.svelte";
import { items, itemsProps, oneItem, oneItemProps } from "./test.fixtures.svelte";

it("renders a single item", async () => {
  const page = render(Component, { children: oneItem });
  await expect.element(page.getByText(oneItemProps.label)).toBeVisible();
});

it("renders multiple items", () => {
  const page = render(Component, { children: items });
  expect(page.getByRole("listitem").elements()).toHaveLength(itemsProps.length);
});
```

### Don't

(Don't) Inline markup and duplicate literal data in each test, which cannot express snippets and drifts from the rendered content.
```typescript
it("renders multiple items", () => {
  // Snippet content cannot be declared here, so tests hardcode expectations
  const page = render(Component);
  expect(page.getByText("First")).toBeVisible();
  expect(page.getByText("Second")).toBeVisible();
});
```

---

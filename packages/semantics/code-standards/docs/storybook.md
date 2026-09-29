# Storybook Standards

Standards for storybook development.

## Documentation from TSDoc

**Identifier:** `cs:storybook.documentation.source`

Component documentation must primarily come from TSDoc comments on the component signature and props. Storybook docs overrides should only be used when the documentation needs to differ between code and Storybook contexts.

### Do

Use TSDoc comments for primary documentation.
```typescript
// ContextualMenu/types.ts
export interface ContextualMenuProps extends HTMLAttributes<HTMLDivElement> {
  /** The element that triggers the contextual menu */
  children: ReactElement;
  /** The items to display in the contextual menu */
  items: MenuItem[];
}

// ContextualMenu/ContextualMenu.tsx
/**
 * A wrapper component that adds a contextual menu to its children.
 * The menu appears when the children are clicked or activated via keyboard.
 */
const ContextualMenu = ({
  children,
  items,
}: ContextualMenuProps): ReactElement => {
  // ...
};
```

### Don't

Add documentation in Storybook parameters when TSDoc is sufficient.
```typescript
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        component: "A wrapper component that adds a contextual menu to its children" // Covered in TSDoc
      }
    }
  }
};
```

---

## Shared decorators for context

**Identifier:** `cs:storybook.story.decorator`

Decorators must be used to wrap stories in common context providers or layout elements. Decorators should generally be defined in `storybook/decorators.tsx` and be imported as `decorators` in the storybook file. Decorators may be defined inline in story files in limited circumstances when it would be difficult to globally define a semantic decorator (e.g., a decorator that provides mock data specific to that component).

### Do

Use decorators for static context or layout wrapping.
```typescript
// storybook/decorators.tsx

export const theme = (Story: StoryFn<typeof Component>) => (
  <ThemeProvider theme="dark">
    <Story />
  </ThemeProvider>
);

export const config = (Story: StoryFn<typeof Component>) => (
  <ConfigProvider locale="en">
    <Story />
  </ConfigProvider>
);

// src/ui/<ComponentName>/<ComponentName>.stories.tsx

import * as decorators from "storybook/decorators.js";
export const WithTheme: Story = {
  decorators: [decorators.theme],
  args: {
    variant: "primary"
  }
};

// Component-level decorator in meta, applies to all stories in this file.
const meta = {
  decorators: [decorators.config],
} satisfies Meta<typeof Component>;

export default meta;
```

### Don't

Use function-based stories for static wrapping that could be done with decorators.
```typescript
// Bad: Using function-based story for static wrapping
export const WithTheme = (args: ComponentProps) => (
  <ThemeProvider theme="dark">
    <Component {...args} />
  </ThemeProvider>
);
```

---

## Document usage, not implementation

**Identifier:** `cs:storybook.story.documentation`

Story documentation must focus on usage patterns and variations, not implementation details. Each story should demonstrate a specific use case or variation.

### Do

Document usage patterns and variations.
```typescript
export const WithCustomTrigger: Story = {
  args: {
    trigger: <button>Custom Trigger</button>
  },
  parameters: {
    docs: {
      description: {
        story: "The component accepts a custom trigger element to replace the default button."
      }
    }
  }
};
```

### Don't

Document implementation details or internal behavior.
```typescript
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Uses React.createPortal internally to render the popup" // Bad: Implementation detail
      }
    }
  }
};
```

---

## Ontology tier folders and titles

**Identifier:** `cs:storybook.story.folders`

Stories and component folders must be organized by ontology tier under `src/lib/`, and each story's `title` must mirror its tier so it matches the shared Storybook sidebar order (`Documentation` → `subcomponents` → `components` → `patterns` → `common` → `utils` → `_work_in_progress`).

Placement is ontology-gated: a folder only goes under `component/`, `pattern/`, or `subcomponent/` if it is an actual entry in the design-system ontology at that type. Items not present in the ontology, or not yet ready for their tier, live under the verbatim `_work_in_progress/` folder (the leading underscore is literal — the sidebar sort order references this exact name). Non-tier machinery and shared helpers live under `src/lib/common/` and `src/lib/utils/`. Documentation `.mdx` lives in `src/docs/`, titled under `Documentation/...`.

Every story title's top segment must be one of the seven order keys — there is no wildcard catch-all, so a title whose top segment is not an order key will sort unpredictably in the sidebar.

### Do

Folder by ontology tier and mirror the tier in each story title.
```typescript
// src/lib/component/Accordion/Accordion.stories.tsx
// Accordion IS an ontology entry of type Component.
const meta = {
  title: "components/Accordion",
  component: Component,
} satisfies Meta<typeof Component>;

// src/lib/pattern/Timeline/Timeline.stories.tsx
// Timeline IS an ontology entry of type Pattern.
const meta = {
  title: "patterns/Timeline",
  component: Component,
} satisfies Meta<typeof Component>;

// src/lib/_work_in_progress/ColorPicker/ColorPicker.stories.tsx
// Not (yet) an ontology entry: lives under the verbatim _work_in_progress folder.
const meta = {
  title: "_work_in_progress/ColorPicker",
  component: Component,
} satisfies Meta<typeof Component>;
```

### Don't

Title with a maturity tag or an un-foldered segment that matches no order key.
```typescript
// Bad: maturity tag as the top segment (not an order key — floats in the sidebar).
const meta = {
  title: "Stable/Accordion",
} satisfies Meta<typeof Component>;

// Bad: un-foldered segment matching no order key.
const meta = {
  title: "Styles / Typography",
} satisfies Meta<typeof Component>;
```

---

## Choosing a story format

**Identifier:** `cs:storybook.story.format`

Stories must use one of three formats, each serving specific needs:
1. CSF3 (object-based) format must be used for standard component variations where args define the component state.
2. Function-based format must be used when the story needs to directly control component rendering or wrap the component with custom elements.
3. Template-based format must be used when multiple stories share the same logic but differ in their args, and the template differs from the component markup.

### Do

Use the format that matches your specific use case.
```typescript
// CSF3: For standard component variations through args
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "primary",
    children: "Click me",
    disabled: false
  }
};

// Function-based: When story needs dynamic rendering logic
export const WithDynamicChildren = (args: ComponentProps) => {
  const [items] = useState(["Item 1", "Item 2"]);
  return (
    <Component {...args}>
      {items.map((item) => (
        <ListItem key={item}>{item}</ListItem>
      ))}
    </Component>
  );
};

// Template-based: When multiple stories share logic
const Template: StoryFn<typeof Component> = (args) => (
  <div className="button-container">
    <Label>Button:</Label>
    <Component {...args} />
  </div>
);

export const Primary = Template.bind({});
Primary.args = { variant: "primary" };
```

### Don't

Use a format that doesn't match your use case.
```typescript
// Bad: Using function format for simple args variation
export const SimpleButton = () => (
  <Component variant="primary" disabled={false}>
    Click me
  </Component>
);

// Bad: Duplicating complex logic without template
export const First: Story = {
  decorators: [(Story) => (
    <div className="button-container">
      <Label>Button:</Label>
      <Story />
    </div>
  )]
};
```

---

## Generic component import alias

**Identifier:** `cs:storybook.story.import`

Stories must import their component as 'Component' to maintain a consistent, generic reference that is decoupled from the specific component name.

### Do

Import the component generically as 'Component'.
```typescript
import Component from "./SkipLink.js";

const meta = {
  title: "SkipLink",
  component: Component,
} satisfies Meta<typeof Component>;

export const Default: Story = {
  args: {
    children: "Skip to main content"
  }
};
```

### Don't

Import the component using its specific name.
```typescript
import SkipLink from "./SkipLink.js";

const meta = {
  title: "SkipLink",
  component: SkipLink,  // Bad: Using specific component name
} satisfies Meta<typeof SkipLink>;
```

---

## Story naming conventions

**Identifier:** `cs:storybook.story.naming`

Story names must be descriptive and follow a consistent pattern. Use PascalCase for story exports and natural language for story titles.

### Do

Use clear, descriptive names that indicate the variation.
```typescript
export const WithCustomStyles: Story = {
  args: {
    className: "custom",
    children: "Styled Content"
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates custom styling options"
      }
    }
  }
};
```

### Don't

Use technical or implementation-focused names.
```typescript
export const TestCase1: Story = {  // Bad: Non-descriptive name
  args: {
    _testFlag: true,  // Bad: Implementation detail
    children: "Content"
  }
};
```

---

## Group stories by feature

**Identifier:** `cs:storybook.story.organization`

Stories must be organized into logical groups that demonstrate related features and variations. Each story should focus on a specific use case or feature, with clear naming that indicates what aspect of the component it demonstrates.

### Do

Group related features with clear, descriptive names.
```typescript
// Basic usage
export const Default: Story = {
  args: {
    mainId: "main",
    children: "Skip to main content"
  }
};

// Custom element targeting
export const CustomMainElement: Story = {
  args: {
    mainId: "my-main-element",
    children: "Skip to main content"
  }
};

// Content customization
export const CustomText: Story = {
  args: {
    mainId: "main",
    children: "Jump to content"
  }
};
```

### Don't

Use unclear names or mix unrelated features in a single story.
```typescript
// Bad: Unclear what this story demonstrates
export const Variant1: Story = {
  args: {
    mainId: "custom",
    children: "Skip",
    className: "special",
    onClick: () => {},
    style: { color: "red" }
  }
};
```

---

## Nest subcomponents under their parent

**Identifier:** `cs:storybook.story.subcomponent_nesting`

A subcomponent that has a parent component must stay nested inside the parent at `src/lib/component/<Parent>/common/<Part>/`, and its story `title` must nest it under the parent in the sidebar as `components/<Parent>/<Part>` (e.g. `components/Accordion/Item`). Such a subcomponent must never be hoisted to a top-level `src/lib/subcomponent/` folder or titled into the top-level `subcomponents/` sidebar group.

Only free-standing subcomponents — those with no parent component — get their own top-level `src/lib/subcomponent/<Name>/` folder and a `subcomponents/<Name>` title. The top-level `subcomponents/` sidebar group is reserved for those.

### Do

Nest a parented subcomponent's story under its parent component.
```typescript
// src/lib/component/Accordion/common/Item/Item.stories.tsx
// Item has a parent (Accordion): stays nested, title nests under the parent.
const meta = {
  title: "components/Accordion/Item",
  component: Component,
} satisfies Meta<typeof Component>;
```

### Don't

Hoist a parented subcomponent to a top-level subcomponent/ folder or the subcomponents/ sidebar group.
```typescript
// Bad: hoisting a parented subcomponent to a top-level subcomponent/ folder.
// Item has a parent Accordion, so it must stay nested in the parent's common/
// and be titled `components/Accordion/Item`, not lifted into the top-level
// `subcomponents/` sidebar group.
// src/lib/subcomponent/Item/Item.stories.tsx
const meta = {
  title: "subcomponents/Item",
} satisfies Meta<typeof Component>;
```

---

## Behavior testing with play functions

**Identifier:** `cs:storybook.story.testing`

Stories that test component behavior must use the `play` function to simulate user interactions and verify expected outcomes.

### Do

Use play functions to test interactive behavior.
```typescript
export const InteractionTest: Story = {
  args: {
    children: "Click Me",
    onClick: () => {}
  },
  play: async ({ canvasElement, args }) => {
    const button = canvasElement.querySelector("button");
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  }
};
```

### Don't

Test implementation details or internal state.
```typescript
export const InternalTest: Story = {
  play: async ({ component }) => {
    // Bad: Testing internal implementation
    expect(component._internalState).toBe(true);
  }
};
```

---

## Hide test-only stories

**Identifier:** `cs:storybook.story.visibility`

Stories that exist solely for testing or visual coverage but don't represent valid usage patterns must be hidden from documentation and the sidebar using tags.

### Do

Hide test-only stories that don't represent valid usage.
```typescript
export const FocusedState: Story = {
  args: {
    isOpen: true,
    children: "Test Content"
  },
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const element = canvasElement.querySelector(".component");
    element.focus();
  }
};
```

### Don't

Show implementation details or test states in documentation.
```typescript
export const InternalTestState: Story = {
  args: {
    _internalProp: true,  // Bad: Exposing internal state
    children: "Test"
  },
  parameters: {
    docs: {
      description: { story: "Tests internal state" }  // Bad: Implementation detail
    }
  }
};
```

---

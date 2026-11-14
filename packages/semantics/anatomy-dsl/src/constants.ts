import type { StyleStateEntry } from "./types.js";

/**
 * The closed state vocabulary an `@state` suffix may name, in the order the
 * reference lists it. The shapes' `sh:in` on `anatomy:styleState` holds the
 * same names, and a test keeps the two equal.
 */
export const STYLE_STATES = {
  hover: { experimental: false },
  active: { experimental: false },
  focus: { experimental: false },
  disabled: { experimental: false },
  selected: { experimental: false },
  expanded: { experimental: false },
  indeterminate: { experimental: false },
  invalid: { experimental: false },
  /**
   * An inline-editable value whose edit is open.
   *
   * @experimental Admitted for inline editing before any reference
   * implementation binds it, so its meaning and its platform mapping may
   * still change. design-system's `anatomies validate` warns where an
   * anatomy uses it.
   */
  editing: { experimental: true },
} as const satisfies Record<string, StyleStateEntry>;

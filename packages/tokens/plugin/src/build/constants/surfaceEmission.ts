/**
 * What each surface context emits, and which of those are resets.
 *
 * The compiled twin of `profiles/css.json`, kept for the same reason every
 * other constant beside this file is kept: a plugin used WITHOUT a profile
 * must behave exactly as before. That invariant would otherwise have broken
 * here — the layer1 and modal source files are now headers with no tokens, so
 * without a declared set those two contexts infer an empty emission and stop
 * resetting anything at all.
 *
 * Deleted with the rest of the constants when the profile becomes the only
 * source. `extraction.tests.ts` compares the two meanwhile.
 */
export const SURFACE_EMITS: Record<string, readonly string[]> = {
  layer1: [
    "color-background",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
  ],
  layer2: [
    "color-background",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
  ],
  layer3: [
    "color-background",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
  ],
  contrasted: [
    "color-background",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
    "color-text",
  ],
  modal: [
    "color-background",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
  ],
};

/**
 * Variables a context emits as `--surface-x: var(--x)` — sending a nested
 * surface back to the unmodified value rather than overriding it.
 */
export const SURFACE_RESETS: Record<string, readonly string[]> = {
  layer1: [
    "color-background",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
  ],
  modal: [
    "color-background",
    "color-foreground-ghost",
    "color-foreground-ghost-branded",
    "color-foreground-ghost-constructive",
    "color-foreground-ghost-destructive",
    "color-foreground-input",
    "color-foreground-input-error",
    "color-foreground-input-success",
    "color-foreground-input-warning",
    "color-foreground-navigation-primary",
    "color-foreground-checkbox-checkmark",
    "color-foreground-checkbox-unselected",
    "color-foreground-radio-checkmark",
    "color-foreground-radio-unselected",
    "color-foreground-switch-knob",
  ],
};

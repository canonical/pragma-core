import type { TooltipOptions } from "./types.js";

export const COMPLETION_BADGE = {
  artifact: "\u25CF",
  property: "\u00AE",
  local: "\u25C8",
  external: "\u2A21",
  buffer: "\u25CC",
} as const;

export const COMPLETION_DERIVATION_LABEL: Readonly<Record<string, string>> = {
  hover: "hover",
  active: "active",
  disabled: "disabled",
  delta: "delta",
} as const;

export const COMPLETION_SORT_PREFIX = {
  artifact: "0",
  property: "1",
  local: "2",
  external: "2",
  buffer: "3",
} as const;

/**
 * Tier → badge icon map. Unknown tiers fall back to {@link TIER_BADGE_DEFAULT}.
 *
 * Common tiers: `"primitive"` (◇), `"semantic"` (●), `"derived"` (▲).
 */
export const TIER_BADGE: Readonly<Record<string, string>> = {
  primitive: "\u25C7",
  semantic: "\u25CF",
  derived: "\u25B2",
} as const;

/** Fallback badge for unrecognised tier values. */
export const TIER_BADGE_DEFAULT = "\u25CB";

/**
 * Tier → display label map. Unknown tiers are title-cased automatically.
 */
export const TIER_LABEL: Readonly<Record<string, string>> = {
  primitive: "Primitive",
  semantic: "Semantic",
  derived: "Derived",
} as const;

export const HOVER_OPTIONS: TooltipOptions = {
  showProvenanceBadge: true,
  showDescription: true,
  showMetadataFooter: true,
  showSelectorContext: true,
};

export const COMPLETION_OPTIONS: TooltipOptions = {
  showProvenanceBadge: true,
  showDescription: true,
  showMetadataFooter: true,
  showSelectorContext: true,
};

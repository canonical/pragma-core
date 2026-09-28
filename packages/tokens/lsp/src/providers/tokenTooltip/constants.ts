import type { TokenProvenance } from "../../types/index.js";

export { TIER_BADGE, TIER_BADGE_DEFAULT, TIER_LABEL } from "../constants.js";

export const PROVENANCE_BADGE: Readonly<
  Record<TokenProvenance["kind"], string>
> = {
  artifact: "●",
  property: "®",
  local: "◈",
  external: "⨡",
} as const;

export const DERIVATION_LABEL: Readonly<Record<string, string>> = {
  hover: "hover state",
  active: "active state",
  disabled: "disabled state",
  delta: "lightness delta",
} as const;

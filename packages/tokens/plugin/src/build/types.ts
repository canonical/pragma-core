import type { CSSDeclaration } from "../css-ast/types.js";

/** Set-level filtering. */
export interface SetConfig {
  /** Glob patterns to exclude from the set output. */
  exclude?: string[];
}

/** Typography modifier configuration. */
export interface TypographyConfig {
  /** Resolver modifier name. */
  modifier: string;
}

/** NativeState derivation layer configuration. */
export interface StatesConfig {
  /** CSS selector for the derivation block. @default "*" */
  selector: string;
}

/** Per-role delta values for NativeState derivation. */
export interface StateDelta {
  /** Semantic role (e.g. "color-foreground-primary"). */
  role: string;
  /** State kind (e.g. "hover", "active"). */
  state: string;
  /** Light-mode oklch L delta. */
  lightDelta: number;
  /** Dark-mode oklch L delta. */
  darkDelta: number;
}

/** Interactive role metadata used by state and delta generation. */
export interface InteractiveRole {
  /** Semantic token id for the interactive role. */
  role: string;
  /** State variants emitted for the role. */
  states: string[];
  /** Whether the role participates in surface fallback chaining. */
  hasSurface: boolean;
  /** Whether the role participates in modifier fallback chaining. */
  hasModifier: boolean;
}

/** Minimal object shape for an oklch token value. */
export interface OklchColorValue {
  colorSpace: "oklch";
  components: number[];
}

/** Delta declaration groups emitted for theme generation. */
export interface DeltaDeclarations {
  /** Default light-mode delta declarations emitted on `:root`. */
  lightDeltaDecls: CSSDeclaration[];
  /** Dark-mode override delta declarations emitted in dark contexts. */
  darkDeltaDecls: CSSDeclaration[];
}

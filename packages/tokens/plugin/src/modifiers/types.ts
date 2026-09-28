/** Media-driven modifier configuration (motion, contrast). */
export interface MediaModifierConfig {
  /** Resolver modifier name. */
  modifier: string;
  /** Media feature name (e.g. "prefers-reduced-motion"). */
  media: string;
  /** Class-based override selectors, keyed by context name. */
  selectors?: Record<string, string>;
}

/**
 * Surface layer configuration.
 *
 * Overrides the default depth-based `.surface` selector mapping used
 * for surface modifier contexts (layer1, layer2, layer3).
 */
export interface SurfaceConfig {
  /**
   * Map of resolver context names to CSS selectors.
   * @default { layer1: ".surface", layer2: ".surface .surface", layer3: ".surface .surface .surface" }
   */
  selectors?: Record<string, string>;
}

/** Minimal token shape for overlay detection. */
export interface OverlayToken {
  $value?: unknown;
  aliasOf?: string;
  /**
   * The aliases the resolver followed, nearest first.
   *
   * `aliasChain[0]` is the target as AUTHORED; `aliasOf` is where the chain
   * ends. They differ whenever the authored target is itself an alias, and the
   * authored one is what a modifier declaration names.
   */
  aliasChain?: readonly string[];
}

/** A modifier family context with its resolved CSS class declarations. */
export interface ModifierContext {
  /** Family name (e.g. "anticipation"). */
  family: string;
  /** Context name (e.g. "constructive"). */
  context: string;
  /** CSS class selector (e.g. ".constructive"). */
  selector: string;
  /** Declarations: --modifier-{role}: var(--{aliasTarget}). */
  declarations: import("../css-ast/types.js").CSSDeclaration[];
}

/** CSS @layer names. Set a value to `null` to omit the layer wrapper. */
export interface LayerConfig {
  /** Wraps sets (primitive, semantic). @default "ds.tokens" */
  tokens: string | null;
  /** Wraps modifier outputs (theme, typography, families). @default "ds.modifiers" */
  modifiers: string | null;
  /** Wraps surface class output. @default "ds.surfaces" */
  surfaces: string | null;
  /** Wraps derivation layer (states.css). @default "ds.states" */
  states: string | null;
}

/** Fully resolved layer config with defaults applied. */
export interface ResolvedLayerConfig {
  tokens: string | null;
  modifiers: string | null;
  surfaces: string | null;
  states: string | null;
}

/**
 * Resolve partial layer config to a full config with defaults.
 */
import type { ResolvedLayerConfig } from "./types.js";

const DEFAULT_LAYERS: ResolvedLayerConfig = {
  tokens: "ds.tokens",
  modifiers: "ds.modifiers",
  surfaces: "ds.surfaces",
  states: "ds.states",
};

export default function resolveLayerConfig(
  partial?: Partial<ResolvedLayerConfig>,
): ResolvedLayerConfig {
  return { ...DEFAULT_LAYERS, ...partial };
}

import type { GraphStore, PrefixMap } from "../graph/index.js";

/**
 * Options for serialization
 */
export interface SerializeOptions {
  prefixes: PrefixMap;
}

/**
 * Serializer function type
 */
export type Serializer = (
  store: GraphStore,
  options: SerializeOptions,
) => Promise<string>;

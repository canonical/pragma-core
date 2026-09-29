/**
 * Build context — shared state threaded through all build-phase helpers.
 *
 * The plugin's `build()` hook constructs this once, then passes it
 * (or a subset) to each build helper.
 */
import type { Artifact } from "../artifact/types.js";
import type { ResolvedLayerConfig } from "../layers/types.js";
import type {
  GetTransformsFn,
  OutputFileFn,
  ResolverLike,
  TokenMap,
} from "./shims.js";

/** Shared build context passed to every build helper. */
export interface BuildContext {
  /** Registered token transforms. */
  tokens: TokenMap;
  /** Query transforms by format / id / type / input. */
  getTransforms: GetTransformsFn;
  /** Resolver for applying modifier permutations. */
  resolver: ResolverLike;
  /** Resolved @layer configuration. */
  layers: ResolvedLayerConfig;
  /** Mutable artifact map — populated by build helpers. */
  artifact: Artifact;
  /** Write an output file. */
  outputFile: OutputFileFn;
  /** Base directory for DTCG token source files. */
  tokensDir: string;
  /** Modifier family names. */
  families: string[];
}

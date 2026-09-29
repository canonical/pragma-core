/**
 * Plugin composition-root shim.
 *
 * Keeps the historical `plugin.ts` entry point while the implementation,
 * its sidecar tests, and its option types live together under `plugin/`.
 */
export { default } from "./plugin/index.js";
export type {
  CanonicalPluginOptions,
  LineHeightException,
  RationalCount,
} from "./plugin/types.js";

/**
 * @canonical/summon-package
 *
 * Package generators for Summon: scaffold new npm packages with proper
 * configuration, and Storybook playgrounds for prototyping components.
 */

import type { AnyGenerator } from "@canonical/summon-core";
import { generator as packageGenerator } from "./package/index.js";
import { generator as playgroundGenerator } from "./playground/index.js";

export const generators = {
  package: packageGenerator,
  playground: playgroundGenerator,
} as const satisfies Record<string, AnyGenerator>;

export default generators;

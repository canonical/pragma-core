import { resolve } from "node:path";
import { RULES } from "../src/value.js";

/** Join YAML lines into a document, as a file or a pipe carries it. */
function joinLines(lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

/** A valid anatomy file shipped with the package. */
export const VALID_FILE = resolve(
  import.meta.dirname,
  "..",
  "examples",
  "yaml",
  "card.anatomy.yaml",
);

/** The smallest valid anatomy. */
export const MINIMAL = joinLines(["node:", "  uri: global.component.button"]);

/** A primitive before the end of a sequence, rejected at 4:23. */
export const PRIMITIVE_NOT_LAST = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    motion.property: [background-color, color]",
]);

/** The message `PRIMITIVE_NOT_LAST` is rejected with. */
export const PRIMITIVE_NOT_LAST_MESSAGE = `style value of motion.property "background-color" is rejected: ${RULES.primitiveNotLast}`;

/** A slash path under a state-suffixed key, rejected at 4:34. */
export const STATE_SUFFIXED = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    appearance.background@hover: color/background/hover",
]);

/** The same broken value in a prop and a child's style; only the style counts (11:16). */
export const SAME_KEY = joinLines([
  "node:",
  "  uri: global.component.button",
  "  props:",
  "    gap: x/y",
  "  styles:",
  "    gap: spacing.gap",
  "  edges:",
  "    - node:",
  "        role: label",
  "        styles:",
  "          gap: x/y",
  "      relation:",
  '        cardinality: "1"',
]);

/** A broken value reached through an alias in a flow map, rejected at 4:43. */
export const FLOW_ALIAS = joinLines([
  "node:",
  "  uri: global.component.button",
  "  props: {spacing: &gap x/y}",
  "  styles: {layout.type: flex, layout.gap: *gap}",
]);

/** A document without the top-level `node` key. */
export const NO_NODE = joinLines(["uri: global.component.button"]);

/** An edge without a target: a structural error, which has no location. */
export const EDGE_WITHOUT_TARGET = joinLines([
  "node:",
  "  uri: global.component.button",
  "  edges:",
  "    - relation:",
  '        cardinality: "1"',
]);

/** Styles given by an alias to another mapping: the value has no `styles` entry to point at. */
export const ALIASED_STYLES = joinLines([
  "node:",
  "  uri: global.component.button",
  "  props: &shared {gap: x/y}",
  "  styles: *shared",
]);

/** A style key with no value, rejected just after the colon (4:9). */
export const EMPTY_VALUE = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    gap:",
]);

/** A collection used as a style key before the broken value (6:10). */
export const COLLECTION_KEY = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    ? [a]",
  "    : b",
  "    gap: x/y",
]);

/**
 * A child's style, earlier in the document, breaks a different rule under the
 * same key; the root's own style is the one rejected (9:10).
 */
export const DIFFERENT_RULE_FIRST = joinLines([
  "node:",
  "  uri: global.component.button",
  "  edges:",
  "    - node:",
  "        role: label",
  "        styles:",
  "          gap:",
  "      relation:",
  '        cardinality: "1"',
  "  styles:",
  "    gap: x/y",
]);

/** A bare key in a flow map: there is no value node, so it is located at the key (3:12). */
export const BARE_FLOW_KEY = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles: {gap}",
]);

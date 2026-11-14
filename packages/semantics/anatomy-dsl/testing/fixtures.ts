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

/** A document without the top-level `node` key, which names its own key (1:1). */
export const NO_NODE = joinLines(["uri: global.component.button"]);

/** An edge without a target, located at the edge's mapping (4:7). */
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

/** A flow sequence left open, rejected where the document ends (5:1). */
export const UNCLOSED_FLOW = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    typography.color: [modifier.color.text, color.text",
]);

/** The message `UNCLOSED_FLOW` is rejected with. */
export const UNCLOSED_FLOW_REASON =
  "Flow sequence in block collection must be sufficiently indented and end with a ]";

/** A key given twice in one mapping, rejected at the second (3:3). */
export const DUPLICATE_KEY = joinLines([
  "node:",
  "  uri: global.component.button",
  "  uri: global.component.link",
]);

/** A second YAML document after the anatomy, rejected at its `---` (3:1). */
export const SECOND_DOCUMENT = joinLines([
  "node:",
  "  uri: global.component.button",
  "---",
  "node:",
  "  uri: global.component.link",
]);

/** A misspelt key on the root node, rejected at the key (3:3). */
export const UNKNOWN_KEY = joinLines([
  "node:",
  "  uri: global.component.button",
  "  style:",
  "    layout.type: flow",
]);

/** A child's `edges` written beside its edge's `node`, rejected at 7:7. */
export const EDGE_LEVEL_EDGES = joinLines([
  "node:",
  "  uri: global.component.button",
  "  edges:",
  "    - node: { uri: global.subcomponent.button_label }",
  "      relation:",
  '        cardinality: "1"',
  "      edges:",
  "        - uri: global.component.icon",
  "          relation:",
  '            cardinality: "1"',
]);

/** An edge without its `relation`, located at the edge's mapping (4:7). */
export const MISSING_RELATION = joinLines([
  "node:",
  "  uri: global.component.button",
  "  edges:",
  "    - node: { uri: global.subcomponent.button_label }",
]);

/**
 * A node projection reused as a relation projection through an alias: the
 * relation's copy is rejected (a relation projection takes no `on`), and the
 * key sits in the anchored mapping, so it is located at the alias (6:52).
 */
export const ALIASED_PROJECTION = joinLines([
  "node:",
  "  uri: global.component.list",
  "  projection: &shared { on: Thing, field: items }",
  "  edges:",
  "    - node: { role: row }",
  '      relation: { cardinality: "0..*", projection: *shared }',
]);

/** A relation without its `cardinality`, located at the relation's mapping (6:9). */
export const MISSING_CARDINALITY = joinLines([
  "node:",
  "  uri: global.component.button",
  "  edges:",
  "    - node: { uri: global.subcomponent.button_label }",
  "      relation:",
  "        slotName: default",
]);

/** A sequence where `props` takes a mapping, located at the key (3:3). */
export const PROPS_SEQUENCE = joinLines([
  "node:",
  "  uri: global.component.icon",
  "  props: [close, small]",
]);

/** Text that is not a mapping at all: no key to point at, so no location. */
export const NOT_A_MAPPING = joinLines(["- not an anatomy"]);

/** A switch case whose `uri` is empty, located at the case (8:13). */
export const EMPTY_CASE_URI = joinLines([
  "node:",
  "  uri: global.component.field",
  "  edges:",
  "    - switch:",
  "        on: props",
  "        cases:",
  "          - uri: global.component.input",
  "          - uri:",
  '      relation: { cardinality: "1" }',
]);

/** A switch case whose `node` is empty, located at the case (7:13). */
export const EMPTY_CASE_NODE = joinLines([
  "node:",
  "  uri: global.component.field",
  "  edges:",
  "    - switch:",
  "        on: props",
  "        cases:",
  "          - node:",
  "          - uri: global.component.input",
  '      relation: { cardinality: "1" }',
]);

/** A compound state marker, located at the style key (4:5). */
export const COMPOUND_STATE = joinLines([
  "node:",
  "  uri: global.component.button",
  "  styles:",
  "    appearance.background@selected@hover: color.background",
]);

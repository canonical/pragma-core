/**
 * An anatomy document that breaks a rule about its keys. The parser throws it
 * for each of these:
 *
 * - an unknown key, named before any rule below;
 * - a value of the wrong shape: a sequence or a scalar where a mapping
 *   belongs, a mapping or a scalar where a sequence (`edges`, `cases`)
 *   belongs, or anything but a non-empty string where a name (`uri`,
 *   `role`, `slotName`, `on`, `field`) belongs;
 * - a mapping document whose only key is an empty `node`, or that has no
 *   key at all, or an anonymous root (a mapping with other keys and no
 *   `node` is reported by its first unknown key; a document that is not a
 *   mapping, such as an empty one, a sequence or prose without a colon,
 *   throws a plain `Error` instead, without a location);
 * - a named node without its `uri`, or an anonymous node without its
 *   `role`;
 * - an edge that is not a mapping, or that has no target or more than one
 *   of `node`, `uri` and `switch`;
 * - an edge without its `relation`;
 * - a relation without a quoted `cardinality`;
 * - a projection with neither `on` nor `field`, or a relation projection
 *   without its `field`;
 * - a style key whose `@state` marker is empty, compound or `@default`;
 * - a switch `on` anything but `props`, `internal` or `override`, or with
 *   fewer than two `cases`;
 * - a switch case with neither or both of `uri` and `node`;
 * - a pin with no value, or a mapping or a sequence as its value.
 *
 * A key with no value reads as absent, whether or not the mapping takes it.
 *
 * Carries the key, the path from the document root to the mapping that holds
 * it (`["node", "edges", 0]`), the keys that mapping takes, and the rule, so a
 * caller can point at the key in the source text. For an open mapping, a pin's
 * `props` or a node's `styles`, `allowed` is the keys present. The message
 * opens with "unknown anatomy key" when the key is not one the mapping takes,
 * and with "anatomy key" otherwise.
 */
export default class AnatomyKeyError extends Error {
  constructor(
    readonly key: string,
    readonly path: readonly (string | number)[],
    readonly allowed: readonly string[],
    readonly rule: string,
  ) {
    super(
      `${allowed.includes(key) ? "anatomy key" : "unknown anatomy key"} ${JSON.stringify(key)} at ${spellPath(path)}: ${rule}`,
    );
    this.name = "AnatomyKeyError";
  }
}

/** A path as a reader writes it: `node.edges[0].node`, or `the document`. */
function spellPath(path: readonly (string | number)[]): string {
  if (path.length === 0) return "the document";
  return path
    .map((step, index) =>
      typeof step === "number" ? `[${step}]` : index === 0 ? step : `.${step}`,
    )
    .join("");
}

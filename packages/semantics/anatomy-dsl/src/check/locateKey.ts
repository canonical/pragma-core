import { type Document, isMap, isNode, isScalar } from "yaml";
import type AnatomyKeyError from "../AnatomyKeyError.js";

/**
 * Find the offset of the key an `AnatomyKeyError` names: the key itself in
 * the mapping the error's path reaches, or that mapping where the key is
 * absent (an edge without its `relation`). Returns undefined when the path
 * reaches no node, as through an alias.
 */
export default function locateKey(
  document: Document,
  error: AnatomyKeyError,
): number | undefined {
  const mapping =
    error.path.length === 0
      ? document.contents
      : document.getIn(error.path, true);
  if (!isNode(mapping)) return undefined;
  const pair = isMap(mapping)
    ? mapping.items.find(
        (item) => isScalar(item.key) && String(item.key.value) === error.key,
      )
    : undefined;
  const key = isNode(pair?.key) ? pair.key : mapping;
  return key.range?.at(0);
}

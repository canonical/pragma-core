import {
  type Document,
  isNode,
  isPair,
  isScalar,
  isSeq,
  type Scalar,
  visit,
} from "yaml";
import { type AnatomyValueError, parseStyleValue } from "../value.js";

/**
 * Find the offset of the style value an `AnatomyValueError` names: the first
 * `styles` entry, in document order, whose key and value raise that same
 * error, and within a sequence the element the error quotes. Returns
 * undefined when no entry raises it.
 */
export default function locateStyleValue(
  document: Document,
  error: AnatomyValueError,
): number | undefined {
  let offset: number | undefined;
  visit(document, {
    Pair(_, pair, path) {
      const styles = path.at(-2);
      if (!isPair(styles) || !isScalar(styles.key)) return;
      if (styles.key.value !== "styles") return;
      const authored = pair.key;
      if (!isScalar(authored)) return;
      const key = String(authored.value).split("@").at(0);
      if (key !== error.key) return;
      const value = isNode(pair.value) ? pair.value : undefined;
      try {
        parseStyleValue(value?.toJS(document) ?? null, key);
        return;
      } catch (candidate) {
        if ((candidate as Error).message !== error.message) return;
      }
      const element = isSeq(value)
        ? value.items.find(
            (item): item is Scalar =>
              isScalar(item) && String(item.value) === error.value,
          )
        : undefined;
      offset = (element ?? value ?? authored).range?.at(0);
      return visit.BREAK;
    },
  });
  return offset;
}

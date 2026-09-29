/**
 * Guard against malformed reference IRIs leaking into the emitted graph.
 *
 * Object-property values (e.g. `ds:hasSubcomponent`) are resolved from
 * upstream (Coda) data. A dangling or blank reference can resolve to a
 * *degenerate* `ds:` URI whose local name has empty dot-separated segments:
 *
 *   - `ds:global..`                  (blank subcomponent in a list)
 *   - `ds:global...`                 (blank subcomponent, sole value)
 *   - `ds:.subcomponent.accordion-item`  (missing tier segment)
 *   - `ds:apps_launchpad...`         (blank subcomponent)
 *
 * These are technically valid as *full* IRIs, but become **invalid Turtle**
 * once compacted to prefixed form — a prefixed local name may not be empty
 * nor contain empty `..`-style segments. A single such value makes the whole
 * `.ttl` file unparseable, which takes down every downstream consumer (the
 * pragma CLI's ke store boots by parsing these files).
 *
 * We treat such values as non-emittable: the transform skips them rather than
 * writing invalid Turtle. Only `ds:` references are judged; external or
 * non-namespaced values are left untouched.
 */

import { NAMESPACES } from "../constants.js";

const DS_PREFIX = "ds:";

/** Extract the local name of a `ds:` reference, or `null` if not a ds reference. */
export function dsLocalName(value: string): string | null {
  if (value.startsWith(NAMESPACES.ds)) {
    return value.slice(NAMESPACES.ds.length);
  }
  if (value.startsWith(DS_PREFIX)) {
    return value.slice(DS_PREFIX.length);
  }
  return null;
}

/**
 * True when `value` is safe to emit as a reference IRI.
 *
 * A `ds:` reference is valid only when its local name is non-empty and has no
 * empty dot-separated segments (which would make the compacted prefixed name
 * invalid Turtle). Non-`ds:` values are always considered valid here.
 */
export default function isValidReferenceUri(value: string): boolean {
  const local = dsLocalName(value);
  if (local === null) {
    return true;
  }
  if (local.length === 0) {
    return false;
  }
  return !local.split(".").some((segment) => segment.length === 0);
}

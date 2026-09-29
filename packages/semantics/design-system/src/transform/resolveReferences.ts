import type { Reference } from "../config/types.js";
import { buildUri } from "../graph/index.js";
import type { ReferenceMap } from "./types.js";

/**
 * Build a reference map from table rows
 *
 * Maps both by:
 * - Coda ID (e.g., "i-tier-1") for reference objects
 * - Lowercase display name (e.g., "global") for string lookups
 */
export default function resolveReferences(
  rows: Array<Record<string, unknown>>,
  reference: Reference,
): ReferenceMap {
  const refMap: ReferenceMap = new Map();
  const keyColumn = reference.keyColumn || "Name";

  for (const row of rows) {
    const codaId = row._codaId as string;
    const keyValue = row[keyColumn] as string;
    const uriValue = buildUri(reference.uriTemplate, row);

    // Map by Coda ID (for reference objects)
    if (codaId) {
      refMap.set(codaId, uriValue);
    }

    // Map by display name lowercase (for string-based lookups)
    if (keyValue) {
      refMap.set(keyValue.toLowerCase(), uriValue);
    }
  }

  return refMap;
}

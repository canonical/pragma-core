import type { ReferenceMap } from "./types.js";

/**
 * Coda reference object structure
 */
interface CodaReference {
  id: string;
  name: string;
}

/**
 * Check if a value is a Coda reference object
 */
function isCodaReference(value: unknown): value is CodaReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

/**
 * Resolve a single string value against the reference map
 */
function resolveStringValue(value: string, refMap: ReferenceMap): string {
  // Try exact match first
  const exactMatch = refMap.get(value);
  if (exactMatch) {
    return exactMatch;
  }

  // Try lowercase match
  const lowerMatch = refMap.get(value.toLowerCase().trim());
  if (lowerMatch) {
    return lowerMatch;
  }

  return value;
}

/**
 * Resolve a value that might be a reference
 *
 * Handles:
 * - Coda reference objects ({ id, name })
 * - Plain strings (looked up by lowercase)
 * - CSV strings (split and resolved individually)
 * - Arrays (each element resolved)
 * - Primitives (returned unchanged)
 */
export default function resolveValue(
  value: unknown,
  refMap: ReferenceMap,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, refMap));
  }

  if (isCodaReference(value)) {
    // Try by ID first, then by name
    const byId = refMap.get(value.id);
    if (byId) {
      return byId;
    }
    return resolveStringValue(value.name, refMap);
  }

  if (typeof value === "string" && value.length > 0) {
    // Check if it's a CSV (multiple values)
    if (value.includes(",")) {
      const parts = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return parts.map((part) => resolveStringValue(part, refMap));
    }
    return resolveStringValue(value, refMap);
  }

  // Return primitives unchanged
  return value;
}

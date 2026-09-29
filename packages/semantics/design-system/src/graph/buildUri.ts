/**
 * Convert a string to URI-safe format
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Keeps dots (for versions like 1.0.0)
 * - Removes other special characters
 */
function toUriSafe(str: string, lowercase = true): string {
  let result = str.replace(/\s+/g, "-");
  if (lowercase) {
    result = result.toLowerCase();
    result = result.replace(/[^a-z0-9.-]/g, "");
  } else {
    result = result.replace(/[^a-zA-Z0-9.-]/g, "");
  }
  return result;
}

/**
 * Check if a template is for an ontology namespace URI
 * Ontology URIs should preserve the case of class/property names
 * e.g., "ds:{Name}" should produce "ds:Component", not "ds:component"
 */
function isOntologyTemplate(template: string): boolean {
  // Common ontology namespace prefixes (ds: is the unified design system namespace)
  const ontologyPrefixes = ["ds:", "rdf:", "rdfs:", "owl:", "xsd:", "skos:"];
  // Also check for full namespace URIs
  const ontologyNamespaces = [
    "https://ds.canonical.com/",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "http://www.w3.org/2000/01/rdf-schema#",
    "http://www.w3.org/2002/07/owl#",
    "http://www.w3.org/2001/XMLSchema#",
    "http://www.w3.org/2004/02/skos/core#",
  ];
  return (
    ontologyPrefixes.some((prefix) => template.startsWith(prefix)) ||
    ontologyNamespaces.some((ns) => template.startsWith(ns))
  );
}

/**
 * Build a URI from a template and row data
 *
 * Template uses column names in braces: {name}, {version}
 *
 * If template is just a single column reference like "{uri}",
 * returns the raw value without transformation.
 *
 * For ontology templates (ds:, rdf:, etc.), preserves case of values.
 *
 * Otherwise, interpolates all placeholders and converts values
 * to URI-safe format (lowercase, hyphens for spaces).
 */
export default function buildUri(
  template: string,
  row: Record<string, unknown>,
): string {
  // If template is just a single column reference like "{uri}", return raw value
  const singleColumnMatch = template.match(/^\{(\w+)\}$/);
  if (singleColumnMatch) {
    const value = row[singleColumnMatch[1]];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  }

  // Determine if we should preserve case (ontology URIs)
  const preserveCase = isOntologyTemplate(template);

  // Otherwise, interpolate and transform
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = row[key];
    if (value === undefined || value === null) {
      return "";
    }
    const strValue = String(value);
    return toUriSafe(strValue, !preserveCase);
  });
}

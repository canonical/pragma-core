/**
 * RDF namespace URIs used throughout the application
 */
export const NAMESPACES = {
  ds: "https://ds.canonical.com/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  /**
   * The anatomy vocabulary, `@canonical/anatomy-dsl`'s own namespace. Only
   * `styleKey` and `styleState` are used here: ADR J §6.1 reuses them on
   * `ds:TokenBinding` rather than minting `ds:` twins, which is why
   * anatomy-dsl 0.4.0 drops their `rdfs:domain`.
   */
  anatomy: "https://anatomy.canonical.com/",
  /** The token vocabulary, `@canonical/token-ontology`'s namespace. */
  dt: "https://dt.canonical.com/",
} as const;

/**
 * Common RDF predicates
 */
export const PREDICATES = {
  type: `${NAMESPACES.rdf}type`,
  name: `${NAMESPACES.ds}name`,
  summary: `${NAMESPACES.ds}summary`,
  tier: `${NAMESPACES.ds}tier`,
  hasModifierFamily: `${NAMESPACES.ds}hasModifierFamily`,
  anatomyDsl: `${NAMESPACES.ds}anatomyDsl`,
  hasTokenBinding: `${NAMESPACES.ds}hasTokenBinding`,
  consumesSymbol: `${NAMESPACES.ds}consumesSymbol`,
  viaBlock: `${NAMESPACES.ds}viaBlock`,
  bindingNode: `${NAMESPACES.ds}node`,
  rank: `${NAMESPACES.ds}rank`,
  styleKey: `${NAMESPACES.anatomy}styleKey`,
  styleState: `${NAMESPACES.anatomy}styleState`,
} as const;

/** Classes this repository asserts by URI rather than through a table's context. */
export const CLASSES = {
  tokenBinding: `${NAMESPACES.ds}TokenBinding`,
  tokenSymbol: `${NAMESPACES.dt}TokenSymbol`,
} as const;

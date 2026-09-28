/**
 * Load a Terrazzo artifact payload into the runtime graph.
 *
 * Besides registering artifact tokens, this module also materializes embedded
 * declaration metadata so hover, definition, and provenance features continue
 * to work even before any CSS file has been scanned from disk.
 */

import * as path from "node:path";
import buildSelectorContext from "../css/selectors/buildSelectorContext.js";
import type {
  DeclarationNode,
  RawArtifact,
  RawArtifactDeclaration,
  RawArtifactToken,
  RawWrappedArtifact,
} from "../types/index.js";
import parseArtifactToken from "./parseArtifactToken.js";
import type TokenGraph from "./TokenGraph.js";

/**
 * Extract the token entries from a RawArtifact, handling both
 * the flat format (keys are CSS var names) and the wrapped
 * format (`{ tokens: { ... } }`).
 */
function extractTokens(
  artifact: RawArtifact,
): Record<string, RawArtifactToken> {
  // Wrapped format: { version, generator, tokens: { ... } }
  const a = artifact as Record<string, unknown>;
  if (isWrappedArtifactEnvelope(a)) {
    return a.tokens;
  }
  // Flat format — the artifact itself is the token map
  return artifact as Record<string, RawArtifactToken>;
}

function isWrappedArtifactEnvelope(
  value: unknown,
): value is RawWrappedArtifact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    "tokens" in record &&
    "version" in record &&
    "generator" in record &&
    typeof record.tokens === "object" &&
    record.tokens !== null
  );
}

/**
 * Load all tokens from an artifact into a TokenGraph.
 *
 * @param artifactDir - Directory containing the artifact file.
 *   Used to resolve relative `cssOutputFile` paths to absolute URIs.
 */
export default function loadArtifact(
  artifact: RawArtifact,
  graph: TokenGraph,
  packageSource = "",
  artifactDir = "",
): void {
  const tokens = extractTokens(artifact);
  for (const [cssVar, raw] of Object.entries(tokens)) {
    const node = parseArtifactToken(cssVar, raw, packageSource, artifactDir);
    graph.addToken(node);

    // Inject artifact-embedded declarations into the graph so the
    // tooltip's declaration sites section works without CSS scanning.
    if (raw.declarations && raw.declarations.length > 0) {
      injectArtifactDeclarations(cssVar, raw.declarations, graph, artifactDir);
    }
  }

  buildAliasChains(graph);
}

// ---------------------------------------------------------------------------
// Alias chain construction
// ---------------------------------------------------------------------------

const VAR_REF_RE = /^var\((--[\w-]+)\)$/;

/**
 * Post-pass: build alias chains by following `var()` references and
 * falling back to value-matching for resolved literals.
 *
 * Terrazzo resolves alias values to literals in the build output, so
 * many semantic tokens contain `oklch(...)` rather than `var(--x)`.
 * For these, we match the resolved `valueLight` against primitive
 * tokens to reconstruct the semantic → primitive link.
 *
 * After this pass, `token.aliasChain` contains an ordered list of CSS var
 * names from the token down to the primitive value, and `token.isPrimary`
 * is updated accordingly.
 */
function buildAliasChains(graph: TokenGraph): void {
  // Build a reverse index: valueLight → primitive token cssVar.
  // Used as a fallback when the semantic token's value is a resolved
  // literal rather than a var() reference.
  const primitiveByValue = new Map<string, string>();
  for (const t of graph.tokenValues()) {
    if (t.provenance.kind !== "artifact") continue;
    if (t.tier === "primitive" && t.valueLight) {
      // First primitive wins — multiple primitives may share a value
      // but the first is a reasonable default.
      if (!primitiveByValue.has(t.valueLight)) {
        primitiveByValue.set(t.valueLight, t.cssVar);
      }
    }
  }

  for (const token of graph.tokenValues()) {
    if (token.provenance.kind !== "artifact") continue;

    const chain: string[] = [];
    const visited = new Set<string>();
    let current = token.valueLight;

    while (current) {
      const match = VAR_REF_RE.exec(current);
      if (!match) break;
      const ref = match[1];
      if (visited.has(ref)) break; // guard against cycles
      visited.add(ref);
      chain.push(ref);
      const target = graph.resolveToken(ref);
      if (!target) break;
      current = target.valueLight;
    }

    // Fallback: if no var() chain was found and this is a non-primitive
    // token, try to match its resolved literal value to a primitive.
    if (chain.length === 0 && token.tier !== "primitive" && token.valueLight) {
      const primitiveVar = primitiveByValue.get(token.valueLight);
      if (primitiveVar && primitiveVar !== token.cssVar) {
        chain.push(primitiveVar);
      }
    }

    if (chain.length > 0) {
      token.aliasChain = chain;
      token.isPrimary = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Artifact declaration injection
// ---------------------------------------------------------------------------

/**
 * Convert artifact-embedded declarations into DeclarationNode objects
 * and inject them into the graph's declaration stores.
 *
 * This allows the tooltip to display declaration sites (selectors like
 * `:root`, `.warning`, `.constructive`) without requiring CSS file scanning.
 */
function injectArtifactDeclarations(
  cssVar: string,
  rawDecls: RawArtifactDeclaration[],
  graph: TokenGraph,
  artifactDir: string,
): void {
  for (const rawDecl of rawDecls) {
    // Resolve the file path to an absolute file URI
    const filePath = path.isAbsolute(rawDecl.file)
      ? rawDecl.file
      : artifactDir
        ? path.resolve(artifactDir, rawDecl.file)
        : rawDecl.file;
    const fileUri = filePath.startsWith("file://")
      ? filePath
      : `file://${filePath}`;

    const selectorContext = buildSelectorContext(
      rawDecl.selector,
      rawDecl.atRules ?? [],
    );

    const declNode: DeclarationNode = {
      cssVar,
      fileUri,
      line: rawDecl.line,
      column: 0,
      rawValue: "",
      cssType: "<unknown>",
      selector: selectorContext,
    };

    graph.addDeclaration(declNode);
    graph.markArtifactFile(fileUri);
  }
}

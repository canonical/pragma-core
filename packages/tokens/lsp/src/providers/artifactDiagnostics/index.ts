/**
 * Produce diagnostics for loaded artifact tokens.
 *
 * Unlike `produceDiagnostics` which operates on CSS file content,
 * this function checks the artifact tokens in the graph for DTCG
 * specification compliance issues.
 */
import type { TokenGraph } from "../../graph/index.js";
import type {
  Diagnostic,
  ResolvedConfig,
  TokenNode,
} from "../../types/index.js";
import checkBrokenAlias from "./checkBrokenAlias.js";
import checkCircularAlias from "./checkCircularAlias.js";
import checkDraftSyntax from "./checkDraftSyntax.js";
import checkMissingType from "./checkMissingType.js";
import checkSchemaViolation from "./checkSchemaViolation.js";

/** Produce diagnostics for all artifact tokens in the graph. */
const produceArtifactDiagnostics = (
  graph: TokenGraph,
  config: ResolvedConfig,
): Diagnostic[] => {
  const results: Diagnostic[] = [];

  // Build cssVar→token index for alias validation. After loadArtifact's
  // buildAliasChains pass, `aliasChain` entries are resolved CSS var names
  // (the graph's primary key), so the lookup must be keyed by cssVar — not
  // by DTCG id, which would flag every aliased token as broken.
  const tokenByCssVar = new Map<string, TokenNode>();
  for (const token of graph.tokenValues()) {
    if (token.provenance.kind === "artifact") {
      tokenByCssVar.set(token.cssVar, token);
    }
  }

  for (const token of graph.tokenValues()) {
    if (token.provenance.kind !== "artifact") continue;
    checkMissingType(token, config, results);
    checkDraftSyntax(token, config, results);
    checkBrokenAlias(token, tokenByCssVar, config, results);
    checkCircularAlias(token, config, results);
    checkSchemaViolation(token, config, results);
  }

  return results;
};

export default produceArtifactDiagnostics;

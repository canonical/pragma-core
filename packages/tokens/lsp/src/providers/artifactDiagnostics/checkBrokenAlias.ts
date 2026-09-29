/** Flag alias chains referencing non-existent tokens. */
import type {
  Diagnostic,
  ResolvedConfig,
  TokenNode,
} from "../../types/index.js";
import makeDiagnostic from "../makeDiagnostic.js";

export default function checkBrokenAlias(
  token: TokenNode,
  tokenByCssVar: Map<string, TokenNode>,
  config: ResolvedConfig,
  results: Diagnostic[],
): void {
  const severity = config.diagnostics.get("dtcg/broken-alias");
  if (!severity) return;
  if (token.aliasChain.length === 0) return;

  for (const aliasVar of token.aliasChain) {
    if (!tokenByCssVar.has(aliasVar)) {
      results.push(
        makeDiagnostic(
          token.sourceLine ?? 0,
          0,
          severity,
          "dtcg/broken-alias",
          `Token \`${token.id || token.cssVar}\` (\`${token.cssVar}\`) aliases \`${aliasVar}\` which does not exist. [DTCG 2025.10 \u2014 \u00A76.3: aliases]`,
        ),
      );
      break; // Report once per token
    }
  }
}

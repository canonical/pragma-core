/** Flag tokens with no explicit `$type`. */
import type {
  Diagnostic,
  ResolvedConfig,
  TokenNode,
} from "../../types/index.js";
import makeDiagnostic from "../makeDiagnostic.js";

export default function checkMissingType(
  token: TokenNode,
  config: ResolvedConfig,
  results: Diagnostic[],
): void {
  const severity = config.diagnostics.get("dtcg/missing-type");
  if (!severity) return;
  if (token.type !== null) return;
  results.push(
    makeDiagnostic(
      token.sourceLine ?? 0,
      0,
      severity,
      "dtcg/missing-type",
      `Token \`${token.id || token.cssVar}\` (\`${token.cssVar}\`) has no explicit \`$type\`. The type is ambiguous and should be specified. [DTCG 2025.10 \u2014 \u00A75: type is required when ambiguous]`,
    ),
  );
}

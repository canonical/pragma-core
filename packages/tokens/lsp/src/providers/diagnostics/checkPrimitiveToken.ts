import { formatFileUri } from "../../css/index.js";
import * as values from "../../css/values/index.js";
import type { Diagnostic } from "../../types/index.js";
import makeDiagnostic from "../makeDiagnostic.js";
import type { UsageRuleContext } from "./types.js";

/** Check: css/primitive-token — usage of a primitive-tier token outside its output file. */
export default function checkPrimitiveToken(
  ctx: UsageRuleContext,
  results: Diagnostic[],
): void {
  const severity = ctx.config.diagnostics.get("css/primitive-token");
  if (!severity) return;
  if (!ctx.token || ctx.token.provenance.kind !== "artifact") return;
  if (ctx.token.tier !== "primitive") return;
  if (
    ctx.token.cssOutputFile &&
    ctx.fileUri === formatFileUri(ctx.token.cssOutputFile)
  )
    return;
  if (
    values.isSuppressed("css/primitive-token", ctx.usage.line, ctx.directives)
  )
    return;
  results.push(
    makeDiagnostic(
      ctx.usage.line,
      ctx.usage.varNameColumn,
      severity,
      "css/primitive-token",
      `\`${ctx.usage.cssVar}\` is a primitive token${ctx.token.packageSource ? ` (${ctx.token.packageSource} \u00B7 ${ctx.token.id})` : ""}. Primitive tokens are raw palette values \u2014 prefer a semantic token alias. [DTCG 2025.10 \u2014 \u00A76.3: aliases as the indirection mechanism]`,
      ctx.usage.varNameColumn + ctx.usage.varNameLength,
    ),
  );
}

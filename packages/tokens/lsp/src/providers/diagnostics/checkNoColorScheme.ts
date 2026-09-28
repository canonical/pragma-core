import * as values from "../../css/values/index.js";
import type { Diagnostic } from "../../types/index.js";
import makeDiagnostic from "../makeDiagnostic.js";
import type { FileRuleContext } from "./types.js";

/** Check: css/no-color-scheme — light-dark() used without color-scheme property. */
export default function checkNoColorScheme(
  ctx: FileRuleContext,
  results: Diagnostic[],
): void {
  const severity = ctx.config.diagnostics.get("css/no-color-scheme");
  if (!severity) return;
  const hasLightDark = /light-dark\s*\(/.test(ctx.source);
  if (!hasLightDark) return;
  const hasColorScheme = /color-scheme\s*:/.test(ctx.source);
  if (hasColorScheme) return;

  const lines = ctx.source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/light-dark\s*\(/.test(lines[i])) {
      if (values.isSuppressed("css/no-color-scheme", i, ctx.directives))
        continue;
      const col = lines[i].indexOf("light-dark");
      const startCol = col >= 0 ? col : 0;
      const endCol = col >= 0 ? col + "light-dark".length : 0;
      results.push(
        makeDiagnostic(
          i,
          startCol,
          severity,
          "css/no-color-scheme",
          `\`light-dark()\` is used but no \`color-scheme\` property is set in this file. Without \`color-scheme\`, the browser cannot determine which value to use. [CSS Color Level 5 \u2014 \u00A73.4]`,
          endCol,
        ),
      );
      break;
    }
  }
}

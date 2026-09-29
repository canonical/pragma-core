import type {
  Artifact,
  ArtifactAtRule,
  ArtifactDeclaration,
} from "../artifact/types.js";

/**
 * Scan CSS output strings and annotate artifact tokens with their
 * declaration sites (selector, file, line).
 *
 * Parses each CSS file to find custom property declarations (`--var: ...`)
 * and records the enclosing selector and line number. Tokens appearing in
 * multiple selectors (e.g. modifier channels in `.warning`, `.error`, etc.)
 * accumulate all their declaration sites.
 *
 * @note impure — mutates `artifact` token entries in place by adding declaration arrays.
 */
export function annotateDeclarations(
  artifact: Artifact,
  cssOutputs: Map<string, string>,
): void {
  for (const [file, css] of cssOutputs) {
    const lines = css.split("\n");
    const selectorStack: string[] = [];
    const atRuleStack: ArtifactAtRule[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track selector entries: line ending with `{`
      if (trimmed.endsWith("{")) {
        const selector = trimmed.slice(0, -1).trim();
        if (selector.startsWith("@")) {
          // at-rule — parse name and prelude, keep current selector
          const atMatch = selector.match(/^@(\w+)\s*(.*)/);
          const atRule: ArtifactAtRule = atMatch
            ? { name: atMatch[1], prelude: atMatch[2] }
            : { name: selector.slice(1), prelude: "" };
          const parentAtRules = atRuleStack[atRuleStack.length - 1] ?? [];
          atRuleStack.push([...parentAtRules, atRule]);
          selectorStack.push(
            selectorStack[selectorStack.length - 1] ?? ":root",
          );
        } else {
          atRuleStack.push(atRuleStack[atRuleStack.length - 1] ?? []);
          selectorStack.push(selector);
        }
        continue;
      }

      // Track block exits
      if (trimmed === "}") {
        selectorStack.pop();
        atRuleStack.pop();
        continue;
      }

      // Match custom property declarations
      const m = trimmed.match(/^(--[\w-]+)\s*:/);
      if (!m) continue;

      const cssVar = m[1];
      const entry = artifact[cssVar];
      if (!entry) continue;

      const selector = selectorStack[selectorStack.length - 1] ?? ":root";
      const currentAtRules = atRuleStack[atRuleStack.length - 1] ?? [];
      const declSite: ArtifactDeclaration = {
        selector,
        file,
        line: i,
        ...(currentAtRules.length > 0 ? { atRules: currentAtRules } : {}),
      };

      if (entry.declarations) {
        entry.declarations.push(declSite);
      } else {
        entry.declarations = [declSite];
      }
    }
  }
}

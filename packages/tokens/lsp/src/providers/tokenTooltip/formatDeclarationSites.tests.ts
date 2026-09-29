import { describe, expect, it } from "vitest";
import { makeDeclarationNode as makeDeclaration } from "../../testing/index.js";
import formatDeclarationSites from "./formatDeclarationSites.js";

describe("formatDeclarationSites", () => {
  it("deduplicates duplicate lines and keeps the richer at-rule context", () => {
    const result = formatDeclarationSites([
      makeDeclaration({
        cssVar: "--x",
        fileUri: "file:///project/src/theme.css",
        line: 2,
      }),
      makeDeclaration({
        cssVar: "--x",
        fileUri: "file:///project/src/theme.css",
        line: 2,
        selector: {
          selector: ":root",
          atRules: [
            { name: "layer", prelude: "theme" },
            { name: "media", prelude: "(prefers-color-scheme: dark)" },
          ],
          scopeType: "layer",
          isGlobal: true,
          isScoped: false,
        },
      }),
    ]);

    expect(result).toContain("| | Selector | Layer | Source |");
    expect(result).toContain("`theme`");
    expect(result).toContain("@media (prefers-color-scheme: dark)");
    expect(result.match(/theme\.css:3/g)).toHaveLength(1);
  });

  it("uses the compact table when no layers are present", () => {
    const result = formatDeclarationSites([
      makeDeclaration({
        cssVar: "--x",
        fileUri: "file:///project/src/button.css",
        line: 4,
        selector: {
          selector: ".button",
          atRules: [],
          scopeType: "class",
          isGlobal: false,
          isScoped: true,
        },
      }),
    ]);

    expect(result).toContain("| | Selector | Source |");
    expect(result).not.toContain("| | Selector | Layer | Source |");
  });

  it("marks global declarations with a checkmark", () => {
    const result = formatDeclarationSites([
      makeDeclaration({
        cssVar: "--x",
        fileUri: "file:///project/src/theme.css",
        line: 1,
      }),
    ]);

    expect(result).toContain("| ✓ | `:root` | `theme.css:2` |");
  });
});

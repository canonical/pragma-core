import { describe, expect, it } from "vitest";
import type { Artifact } from "../artifact/types.js";
import { annotateDeclarations } from "./annotation.js";

describe("annotateDeclarations", () => {
  it("records selector, file, and line for matching declarations", () => {
    const artifact: Artifact = {
      "--color-text": {
        cssVar: "--color-text",
        id: "color.text",
        type: "color",
        tier: "semantic",
        isPaired: false,
        cssOutputFile: "modifiers.theme.css",
      },
    };
    const cssOutputs = new Map([
      [
        "modifiers.theme.css",
        [":root {", "  --color-text: #111;", "}"].join("\n"),
      ],
    ]);

    annotateDeclarations(artifact, cssOutputs);

    expect(artifact["--color-text"].declarations).toEqual([
      {
        selector: ":root",
        file: "modifiers.theme.css",
        line: 1,
      },
    ]);
  });

  it("accumulates declarations across selectors and preserves at-rules", () => {
    const artifact: Artifact = {
      "--color-text": {
        cssVar: "--color-text",
        id: "color.text",
        type: "color",
        tier: "semantic",
        isPaired: false,
        cssOutputFile: "modifiers.theme.css",
      },
    };
    const cssOutputs = new Map([
      [
        "modifiers.theme.css",
        [
          "@media (prefers-color-scheme: dark) {",
          "  .dark {",
          "    --color-text: #eee;",
          "  }",
          "}",
          ".light {",
          "  --color-text: #111;",
          "}",
        ].join("\n"),
      ],
    ]);

    annotateDeclarations(artifact, cssOutputs);

    expect(artifact["--color-text"].declarations).toEqual([
      {
        selector: ".dark",
        file: "modifiers.theme.css",
        line: 2,
        atRules: [{ name: "media", prelude: "(prefers-color-scheme: dark)" }],
      },
      {
        selector: ".light",
        file: "modifiers.theme.css",
        line: 6,
      },
    ]);
  });

  it("ignores declarations for CSS variables missing from the artifact", () => {
    const artifact: Artifact = {};
    const cssOutputs = new Map([
      ["modifiers.theme.css", ":root {\n  --color-text: #111;\n}"],
    ]);

    annotateDeclarations(artifact, cssOutputs);

    expect(Object.keys(artifact)).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { printRules } from "../css-ast/index.js";
import buildModifierContextCSS from "./buildModifierContextCSS.js";
import computeModifierContext from "./computeModifierContext.js";

describe("buildModifierContextCSS", () => {
  it("wraps declarations in a class selector rule", () => {
    const ctx = computeModifierContext(
      "anticipation",
      "constructive",
      {
        "color.foreground.primary": {
          aliasChain: ["color.palette.neutral.100"],
          aliasOf: "color.palette.neutral.100",
        },
      },
      {
        "color.foreground.primary": {
          aliasChain: ["color.palette.green.520"],
          aliasOf: "color.palette.green.520",
        },
      },
    );

    const nodes = buildModifierContextCSS(ctx);
    const css = printRules(nodes);

    expect(css).toContain(".constructive");
    expect(css).toContain(
      "--modifier-color-foreground-primary: var(--color-palette-green-520)",
    );
  });

  it("returns empty nodes for a context with no shadowed tokens", () => {
    const same = {
      "color.bg": {
        aliasChain: ["color.palette.white"],
        aliasOf: "color.palette.white",
      },
    };
    const ctx = computeModifierContext("emphasis", "muted", same, { ...same });

    const nodes = buildModifierContextCSS(ctx);
    expect(nodes).toHaveLength(0);
  });
});

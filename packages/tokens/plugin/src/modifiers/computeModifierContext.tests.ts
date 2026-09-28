import { describe, expect, it } from "vitest";
import computeModifierContext from "./computeModifierContext.js";

/** A resolved token as the resolver publishes it. */
const token = (aliasChain?: string[], $value?: unknown) => ({
  ...(aliasChain ? { aliasChain, aliasOf: aliasChain.at(-1) } : {}),
  ...($value !== undefined ? { $value } : {}),
});

describe("computeModifierContext", () => {
  it("emits a channel for a token the context rebinds", () => {
    const base = {
      "color.foreground.primary": token(["color.palette.neutral.100"]),
      "color.text.primary": token(["color.palette.black"]),
    };
    const overlay = {
      "color.foreground.primary": token(["color.palette.green.520"]),
      "color.text.primary": token(["color.palette.black"]),
    };

    const result = computeModifierContext(
      "anticipation",
      "constructive",
      base,
      overlay,
    );

    expect(result.family).toBe("anticipation");
    expect(result.context).toBe("constructive");
    expect(result.selector).toBe(".constructive");
    expect(result.declarations).toEqual([
      {
        type: "Declaration",
        property: "--modifier-color-foreground-primary",
        value: "var(--color-palette-green-520)",
      },
    ]);
  });

  it("emits nothing when the context changes nothing", () => {
    const same = { "color.bg": token(["color.palette.white"]) };
    const result = computeModifierContext("emphasis", "muted", same, {
      ...same,
    });
    expect(result.declarations).toHaveLength(0);
  });

  it("emits a rebind that lands on the same value", () => {
    // The reason the source files used to be re-read. `ghost` under `layer3`
    // resolves to the same white as the base, so comparing values calls this
    // no override at all — but the chain says otherwise.
    const value = { colorSpace: "oklch", components: [1, 0, 0], alpha: 1 };
    const base = {
      "color.foreground.ghost": token(["color.background"], value),
    };
    const overlay = {
      "color.foreground.ghost": token(["color.foreground.ghost.layer3"], value),
    };

    const result = computeModifierContext(
      "surface",
      "layer3",
      base,
      overlay,
      "surface",
    );
    expect(result.declarations).toEqual([
      {
        type: "Declaration",
        property: "--surface-color-foreground-ghost",
        value: "var(--color-foreground-ghost-layer3)",
      },
    ]);
  });

  it("does not emit a token that merely follows a rebind", () => {
    // `checkbox.checkmark` names `ghost` exactly as the base does; what moved
    // is one hop further along, and it already follows through that variable.
    const value = { colorSpace: "oklch", components: [1, 0, 0], alpha: 1 };
    const base = {
      "color.foreground.checkbox.checkmark": token(
        ["color.foreground.ghost"],
        value,
      ),
    };
    const overlay = {
      "color.foreground.checkbox.checkmark": token(
        ["color.foreground.ghost", "color.foreground.ghost.constructive"],
        value,
      ),
    };

    const result = computeModifierContext(
      "anticipation",
      "constructive",
      base,
      overlay,
    );
    expect(result.declarations).toHaveLength(0);
  });

  it("names the divergence point when a followed token's value does move", () => {
    // `checkbox.unselected` aliases `input`, which the context rebinds to a
    // different colour. The declaration must name the modified input, not the
    // base one it still points at, and not the final literal.
    const base = {
      "color.foreground.checkbox.unselected": token(
        ["color.foreground.input"],
        { colorSpace: "oklch", components: [0.2, 0, 0], alpha: 1 },
      ),
    };
    const overlay = {
      "color.foreground.checkbox.unselected": token(
        ["color.foreground.input", "color.foreground.input.success"],
        { colorSpace: "oklch", components: [0.5, 0.1, 140], alpha: 1 },
      ),
    };

    const result = computeModifierContext(
      "criticality",
      "success",
      base,
      overlay,
    );
    expect(result.declarations).toEqual([
      {
        type: "Declaration",
        property: "--modifier-color-foreground-checkbox-unselected",
        value: "var(--color-foreground-input-success)",
      },
    ]);
  });

  it("falls back to the token's own variable when there is no alias", () => {
    const base = { "color.bg": token(undefined, "#fff") };
    const overlay = { "color.bg": token(undefined, "#000") };

    const result = computeModifierContext("theme", "dark", base, overlay);
    expect(result.declarations).toEqual([
      {
        type: "Declaration",
        property: "--modifier-color-bg",
        value: "var(--color-bg)",
      },
    ]);
  });

  it("ignores a token the base does not have", () => {
    const result = computeModifierContext(
      "emphasis",
      "branded",
      {},
      { "color.new": token(["color.palette.pink.500"]) },
    );
    expect(result.declarations).toHaveLength(0);
  });

  it("honours a selector override", () => {
    const result = computeModifierContext(
      "surface",
      "layer2",
      {},
      {},
      "surface",
      ".surface .surface",
    );
    expect(result.selector).toBe(".surface .surface");
  });
});

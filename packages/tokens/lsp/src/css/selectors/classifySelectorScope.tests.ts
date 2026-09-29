import { describe, expect, it } from "vitest";
import type { AtRuleContext } from "../../types/index.js";
import classifySelectorScope from "./classifySelectorScope.js";

describe("classifySelectorScope", () => {
  describe("global selectors", () => {
    it.each([":root", "html", "body", ":host", ":host(*)"])(
      'classifies "%s" as global',
      (selector) => {
        expect(classifySelectorScope(selector, [])).toBe("global");
      },
    );

    it("trims whitespace before matching", () => {
      expect(classifySelectorScope("  :root  ", [])).toBe("global");
    });
  });

  describe("universal selector", () => {
    it('classifies "*" as universal', () => {
      expect(classifySelectorScope("*", [])).toBe("universal");
    });

    it("trims whitespace for universal", () => {
      expect(classifySelectorScope("  *  ", [])).toBe("universal");
    });
  });

  describe("at-rule contexts", () => {
    it("classifies @media-wrapped as media", () => {
      const atRules: AtRuleContext[] = [
        { name: "media", prelude: "(prefers-color-scheme: dark)" },
      ];
      expect(classifySelectorScope(".button", atRules)).toBe("media");
    });

    it("classifies @layer-wrapped as layer", () => {
      const atRules: AtRuleContext[] = [
        { name: "layer", prelude: "components" },
      ];
      expect(classifySelectorScope(".button", atRules)).toBe("layer");
    });

    it("classifies @supports-wrapped as supports", () => {
      const atRules: AtRuleContext[] = [
        { name: "supports", prelude: "(display: grid)" },
      ];
      expect(classifySelectorScope("div", atRules)).toBe("supports");
    });

    it("uses the first matching at-rule", () => {
      const atRules: AtRuleContext[] = [
        { name: "media", prelude: "(max-width: 768px)" },
        { name: "layer", prelude: "base" },
      ];
      expect(classifySelectorScope(".card", atRules)).toBe("media");
    });
  });

  describe("class-scoped selectors", () => {
    it.each([
      ".button",
      "#main",
      "div[data-theme]",
      "div > .child",
      ".a + .b",
      ".a ~ .b",
    ])('classifies "%s" as class', (selector) => {
      expect(classifySelectorScope(selector, [])).toBe("class");
    });
  });

  describe("other selectors", () => {
    it.each(["div", "span", "article", "section"])(
      'classifies bare element "%s" as other',
      (selector) => {
        expect(classifySelectorScope(selector, [])).toBe("other");
      },
    );
  });
});

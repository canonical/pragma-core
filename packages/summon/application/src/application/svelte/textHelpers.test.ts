import { describe, expect, it } from "vitest";
import { textHelpers } from "./textHelpers.js";

describe("Svelte textHelpers", () => {
  describe("with intl", () => {
    const { msg, attr, str } = textHelpers(true);

    it("renders markup text as a catalog lookup", () => {
      expect(msg("home.heading", "Home")).toBe('{t("home.heading")}');
    });

    it("renders an attribute value as a catalog lookup", () => {
      expect(attr("nav.label", "Main")).toBe('{t("nav.label")}');
    });

    it("renders an expression as a catalog lookup", () => {
      expect(str("theme.light", "Light")).toBe('t("theme.light")');
    });
  });

  describe("without intl", () => {
    const { msg, attr, str } = textHelpers(false);

    it("renders markup text as the English text", () => {
      expect(msg("home.heading", "Home")).toBe("Home");
    });

    it("renders markup text holding a brace as a string expression", () => {
      expect(msg("x", "inside {#await}")).toBe('{"inside {#await}"}');
    });

    it("renders an attribute value as a quoted string", () => {
      expect(attr("nav.label", "Main")).toBe('"Main"');
    });

    it("renders an attribute value holding a brace as a string expression", () => {
      expect(attr("x", "the `{#await}` block")).toBe(
        '{"the `{#await}` block"}',
      );
    });

    it("renders an expression as a quoted string, escaped", () => {
      expect(str("x", 'Say "hi"')).toBe('"Say \\"hi\\""');
    });
  });
});

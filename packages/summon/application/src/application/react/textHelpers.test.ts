import { describe, expect, it } from "vitest";
import { textHelpers } from "./textHelpers.js";

describe("textHelpers", () => {
  describe("with intl", () => {
    const { msg, attr, str } = textHelpers(true);

    it("renders a JSX child as a catalog lookup", () => {
      expect(msg("home.heading", "Home")).toBe('{t("home.heading")}');
    });

    it("renders a JSX attribute value as a catalog lookup", () => {
      expect(attr("nav.label", "Main")).toBe('{t("nav.label")}');
    });

    it("renders an expression as a catalog lookup", () => {
      expect(str("theme.light", "Light")).toBe('t("theme.light")');
    });
  });

  describe("without intl", () => {
    const { msg, attr, str } = textHelpers(false);

    it("renders a JSX child as the English text", () => {
      expect(msg("home.heading", "Home")).toBe("Home");
    });

    it("renders a JSX attribute value as a quoted string", () => {
      expect(attr("nav.label", "Main")).toBe('"Main"');
    });

    it("renders an expression as a quoted string, escaped", () => {
      expect(str("x", 'Say "hi"')).toBe('"Say \\"hi\\""');
    });
  });
});

import { describe, expect, it } from "vitest";
import decodeEscapes from "./decodeEscapes.js";

describe("decodeEscapes", () => {
  it("decodes each character escape", () => {
    expect(decodeEscapes("\\\" \\' \\\\ \\n \\t \\r \\b \\f")).toBe(
      "\" ' \\ \n \t \r \b \f",
    );
  });

  it("decodes four- and eight-digit code points", () => {
    expect(decodeEscapes("caf\\u00e9 \\U0001F600")).toBe("café 😀");
  });

  it("leaves text without escapes as it is", () => {
    expect(decodeEscapes("plain text")).toBe("plain text");
  });

  it("refuses an escape Turtle does not define", () => {
    expect(() => decodeEscapes("\\d")).toThrow("Unknown escape \\d");
  });
});

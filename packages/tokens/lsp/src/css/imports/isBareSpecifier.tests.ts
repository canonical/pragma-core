import { describe, expect, it } from "vitest";
import isBareSpecifier from "./isBareSpecifier.js";

describe("isBareSpecifier", () => {
  it("returns false for relative paths", () => {
    expect(isBareSpecifier("./styles.css")).toBe(false);
    expect(isBareSpecifier("../theme.css")).toBe(false);
  });

  it("returns false for absolute paths", () => {
    expect(isBareSpecifier("/usr/local/styles.css")).toBe(false);
  });

  it("returns false for URLs", () => {
    expect(isBareSpecifier("https://example.com/styles.css")).toBe(false);
    expect(isBareSpecifier("http://cdn.com/lib.css")).toBe(false);
  });

  it("returns false for data URIs", () => {
    expect(isBareSpecifier("data:text/css,body{}")).toBe(false);
  });

  it("returns true for unscoped package names", () => {
    expect(isBareSpecifier("some-package/dist/styles.css")).toBe(true);
    expect(isBareSpecifier("normalize.css")).toBe(true);
  });

  it("returns true for scoped package names", () => {
    expect(isBareSpecifier("@canonical/tokens/dist/tokens.css")).toBe(true);
    expect(isBareSpecifier("@scope/pkg/lib.css")).toBe(true);
  });
});

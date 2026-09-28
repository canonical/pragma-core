import { describe, expect, it } from "vitest";
import extractPackageName from "./extractPackageName.js";

describe("extractPackageName", () => {
  it("extracts scoped package name", () => {
    expect(
      extractPackageName("/project/node_modules/@acme/ui/dist/tokens.css"),
    ).toBe("@acme/ui");
  });

  it("extracts unscoped package name", () => {
    expect(
      extractPackageName("/project/node_modules/normalize.css/normalize.css"),
    ).toBe("normalize.css");
  });

  it("returns null for non-node_modules paths", () => {
    expect(extractPackageName("/project/src/button.css")).toBeNull();
  });
});

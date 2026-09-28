import { describe, expect, it } from "vitest";
import isExternalPath from "./isExternalPath.js";

describe("isExternalPath", () => {
  it("returns true for node_modules paths", () => {
    expect(
      isExternalPath("/project/node_modules/@acme/ui/dist/tokens.css"),
    ).toBe(true);
  });

  it("returns false for local paths", () => {
    expect(isExternalPath("/project/src/button.css")).toBe(false);
  });

  it("handles nested node_modules", () => {
    expect(
      isExternalPath(
        "/project/node_modules/@acme/ui/node_modules/dep/style.css",
      ),
    ).toBe(true);
  });
});

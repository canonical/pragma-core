import { describe, expect, it } from "vitest";
import createDeclaration from "./createDeclaration.js";

describe("createDeclaration", () => {
  it("creates a Declaration node", () => {
    const declaration = createDeclaration("--color-bg", "#fff");
    expect(declaration).toEqual({
      type: "Declaration",
      property: "--color-bg",
      value: "#fff",
      comment: undefined,
    });
  });

  it("includes a comment when provided", () => {
    const declaration = createDeclaration("--x", "1", "spacing");
    expect(declaration.comment).toBe("spacing");
  });
});

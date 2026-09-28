import { describe, expect, it } from "vitest";
import addDeclarationUnique from "./addDeclarationUnique.js";
import createDeclaration from "./createDeclaration.js";

describe("addDeclarationUnique", () => {
  it("appends a declaration when the property is new", () => {
    const list = [createDeclaration("--x", "1")];
    addDeclarationUnique(list, createDeclaration("--y", "2"));
    expect(list).toHaveLength(2);
  });

  it("does not append when property already exists", () => {
    const list = [createDeclaration("--x", "1")];
    addDeclarationUnique(list, createDeclaration("--x", "2"));
    expect(list).toHaveLength(1);
    expect((list[0] as { value: string }).value).toBe("1");
  });
});

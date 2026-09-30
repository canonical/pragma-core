import { describe, expect, it } from "vitest";
import AnatomySyntaxError from "./AnatomySyntaxError.js";

describe("AnatomySyntaxError", () => {
  it("puts the location before the reason in its message", () => {
    const error = new AnatomySyntaxError("Map keys must be unique", 3, 3);
    expect(error.message).toBe(
      "YAML syntax error at line 3, column 3: Map keys must be unique",
    );
    expect(error.name).toBe("AnatomySyntaxError");
    expect(error).toBeInstanceOf(Error);
  });
});

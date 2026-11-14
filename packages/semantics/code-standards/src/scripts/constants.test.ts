import { describe, expect, it } from "vitest";
import { PREFIXED_NAME } from "./constants.js";

describe("constants", () => {
  it("matches a prefixed name without a statement's closing dot", () => {
    expect("cs:react.component.".match(new RegExp(PREFIXED_NAME))?.at(0)).toBe(
      "cs:react.component",
    );
  });
});

import { describe, expect, it } from "vitest";
import { STYLE_STATES } from "./constants.js";

describe("STYLE_STATES", () => {
  it("holds the nine states of the closed vocabulary, in order", () => {
    expect(Object.keys(STYLE_STATES)).toEqual([
      "hover",
      "active",
      "focus",
      "disabled",
      "selected",
      "expanded",
      "indeterminate",
      "invalid",
      "editing",
    ]);
  });

  it("marks editing, and only editing, experimental", () => {
    const experimental = Object.entries(STYLE_STATES)
      .filter(([, entry]) => entry.experimental)
      .map(([state]) => state);
    expect(experimental).toEqual(["editing"]);
  });
});

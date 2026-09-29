import { describe, expect, it } from "vitest";
import buildDescriptionLookup from "./buildDescriptionLookup.js";

describe("buildDescriptionLookup", () => {
  it("maps token IDs to channel CSS vars with descriptions", () => {
    const descriptions = {
      "color.foreground.primary": "Primary foreground colour",
      "color.text": "Default text colour",
    };
    const result = buildDescriptionLookup(descriptions, "modifier");
    expect(result["--modifier-color-foreground-primary"]).toBe(
      "Primary foreground colour",
    );
    expect(result["--modifier-color-text"]).toBe("Default text colour");
  });

  it("uses surface prefix", () => {
    const descriptions = {
      "color.background": "Background",
    };
    const result = buildDescriptionLookup(descriptions, "surface");
    expect(result["--surface-color-background"]).toBe("Background");
  });

  it("returns an empty map for empty input", () => {
    const result = buildDescriptionLookup({}, "modifier");
    expect(Object.keys(result)).toHaveLength(0);
  });
});

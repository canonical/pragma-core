import { describe, expect, it } from "vitest";
import formatFileUri from "./formatFileUri.js";

describe("formatFileUri", () => {
  it("converts a simple path to a file URI", () => {
    expect(formatFileUri("/project/src/a.css")).toBe(
      "file:///project/src/a.css",
    );
  });

  it("percent-encodes spaces in the path", () => {
    expect(formatFileUri("/my project/src/a.css")).toBe(
      "file:///my%20project/src/a.css",
    );
  });

  it("percent-encodes # in the path", () => {
    expect(formatFileUri("/project/src/color#palette.css")).toBe(
      "file:///project/src/color%23palette.css",
    );
  });

  it("handles paths that already look like they contain %20", () => {
    expect(formatFileUri("/path%20with/literal-percent.css")).toBe(
      "file:///path%2520with/literal-percent.css",
    );
  });
});

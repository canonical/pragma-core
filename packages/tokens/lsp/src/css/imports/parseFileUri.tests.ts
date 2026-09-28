import { describe, expect, it } from "vitest";
import parseFileUri from "./parseFileUri.js";

describe("parseFileUri", () => {
  it("converts a file URI to a path", () => {
    expect(parseFileUri("file:///project/src/a.css")).toBe(
      "/project/src/a.css",
    );
  });

  it("decodes percent-encoded spaces", () => {
    expect(parseFileUri("file:///my%20project/src/a.css")).toBe(
      "/my project/src/a.css",
    );
  });

  it("decodes percent-encoded # character", () => {
    expect(parseFileUri("file:///project/src/color%23palette.css")).toBe(
      "/project/src/color#palette.css",
    );
  });

  it("decodes double-encoded %20", () => {
    expect(parseFileUri("file:///path%2520with/literal-percent.css")).toBe(
      "/path%20with/literal-percent.css",
    );
  });

  it("handles a Windows-style drive letter URI", () => {
    // On Linux, fileURLToPath interprets C: as a path component
    expect(parseFileUri("file:///C:/Users/test.css")).toBe(
      "/C:/Users/test.css",
    );
  });
});

import { describe, expect, it } from "vitest";
import generatorComment from "./generatorComment.js";

describe("generatorComment", () => {
  it("generates basic comment", () => {
    expect(generatorComment("ComponentGenerator")).toBe(
      "// Scaffolded by ComponentGenerator",
    );
  });

  it("includes version when specified", () => {
    expect(generatorComment("ComponentGenerator", { version: "1.0.0" })).toBe(
      "// Scaffolded by ComponentGenerator v1.0.0",
    );
  });

  it("includes timestamp when specified", () => {
    expect(generatorComment("ComponentGenerator", { timestamp: true })).toMatch(
      /^\/\/ Scaffolded by ComponentGenerator on \d{4}-\d{2}-\d{2}/,
    );
  });

  it("includes both version and timestamp", () => {
    expect(
      generatorComment("ComponentGenerator", {
        version: "2.0.0",
        timestamp: true,
      }),
    ).toMatch(/^\/\/ Scaffolded by ComponentGenerator v2\.0\.0 on \d{4}/);
  });

  it("handles generator name with spaces", () => {
    expect(generatorComment("My Generator")).toBe(
      "// Scaffolded by My Generator",
    );
  });
});

describe("generatorComment (html format)", () => {
  it("generates basic HTML comment", () => {
    expect(generatorComment("ComponentGenerator", { format: "html" })).toBe(
      "<!-- Scaffolded by ComponentGenerator -->",
    );
  });

  it("includes version when specified", () => {
    expect(
      generatorComment("ComponentGenerator", {
        version: "1.0.0",
        format: "html",
      }),
    ).toBe("<!-- Scaffolded by ComponentGenerator v1.0.0 -->");
  });

  it("includes timestamp when specified", () => {
    expect(
      generatorComment("ComponentGenerator", {
        timestamp: true,
        format: "html",
      }),
    ).toMatch(/^<!-- Scaffolded by ComponentGenerator on \d{4}-\d{2}-\d{2}/);
  });

  it("includes both version and timestamp", () => {
    expect(
      generatorComment("ComponentGenerator", {
        version: "2.0.0",
        timestamp: true,
        format: "html",
      }),
    ).toMatch(/^<!-- Scaffolded by ComponentGenerator v2\.0\.0 on \d{4}/);
  });
});

describe("generatorComment (jsx format)", () => {
  it("generates JSX comment", () => {
    expect(generatorComment("ComponentGenerator", { format: "jsx" })).toBe(
      "{/* Scaffolded by ComponentGenerator */}",
    );
  });
});

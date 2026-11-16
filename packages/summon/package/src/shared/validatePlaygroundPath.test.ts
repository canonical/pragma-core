import { describe, expect, it } from "vitest";
import validatePlaygroundPath from "./validatePlaygroundPath.js";

describe("validatePlaygroundPath", () => {
  it("accepts relative directory names and nested paths", () => {
    expect(validatePlaygroundPath("playground")).toBe(true);
    expect(validatePlaygroundPath("my-Playground2")).toBe(true);
    expect(validatePlaygroundPath("prototypes/navigation")).toBe(true);
    expect(validatePlaygroundPath("playground/")).toBe(true);
  });

  it("rejects empty values", () => {
    expect(validatePlaygroundPath("")).toContain("required");
    expect(validatePlaygroundPath("   ")).toContain("required");
    expect(validatePlaygroundPath(undefined)).toContain("required");
  });

  it("rejects paths that leave the working directory", () => {
    expect(validatePlaygroundPath("/tmp/playground")).toContain("absolute");
    expect(validatePlaygroundPath("C:\\playground")).toContain("absolute");
    expect(validatePlaygroundPath("../Playground")).toContain('".."');
    expect(validatePlaygroundPath("a/../b")).toContain('".."');
  });

  it("rejects segments that are not names", () => {
    expect(validatePlaygroundPath("2fast")).toContain('"2fast"');
    expect(validatePlaygroundPath("my_playground")).toContain(
      '"my_playground"',
    );
    expect(validatePlaygroundPath("./playground")).toContain('"."');
  });
});

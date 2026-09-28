import { describe, expect, it } from "vitest";
import ConfigNotFoundError from "./ConfigNotFoundError.js";

describe("ConfigNotFoundError", () => {
  it("extends Error with the config filename in the message", () => {
    const err = new ConfigNotFoundError("/project", [
      "/project/terrazzo-lsp.config.json",
    ]);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("terrazzo-lsp.config.json");
    expect(err.message).toContain("/project");
  });

  it("sets name to ConfigNotFoundError", () => {
    const err = new ConfigNotFoundError("/x", []);
    expect(err.name).toBe("ConfigNotFoundError");
  });

  it("stores searchStart and searchedPaths", () => {
    const paths = ["/a/terrazzo-lsp.config.json", "/terrazzo-lsp.config.json"];
    const err = new ConfigNotFoundError("/a", paths);
    expect(err.searchStart).toBe("/a");
    expect(err.searchedPaths).toEqual(paths);
  });

  it("getLogLines returns formatted lines with all searched paths", () => {
    const err = new ConfigNotFoundError("/root", [
      "/root/terrazzo-lsp.config.json",
      "/terrazzo-lsp.config.json",
    ]);
    const lines = err.getLogLines();
    expect(lines[0]).toContain("Config not found");
    expect(lines[1]).toContain("/root");
    expect(lines.some((l) => l.startsWith("Tried:"))).toBe(true);
    expect(lines.at(-1)).toContain("Create one with");
  });

  it("getLogLines handles empty searchedPaths", () => {
    const err = new ConfigNotFoundError("/x", []);
    const lines = err.getLogLines();
    expect(lines).toHaveLength(3); // header, search start, create hint
  });
});

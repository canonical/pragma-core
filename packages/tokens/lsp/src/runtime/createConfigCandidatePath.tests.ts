import { describe, expect, it } from "vitest";
import createConfigCandidatePath from "./createConfigCandidatePath.js";

describe("createConfigCandidatePath", () => {
  it("joins directory with the config filename", () => {
    expect(createConfigCandidatePath("/project")).toBe(
      "/project/terrazzo-lsp.config.json",
    );
  });

  it("handles nested directories", () => {
    expect(createConfigCandidatePath("/a/b/c")).toBe(
      "/a/b/c/terrazzo-lsp.config.json",
    );
  });

  it("handles root directory", () => {
    expect(createConfigCandidatePath("/")).toBe("/terrazzo-lsp.config.json");
  });
});

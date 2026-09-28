import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import createServerState from "../createServerState.js";
import loadConfiguredArtifacts from "./loadConfiguredArtifacts.js";

function makeArtifact() {
  return {
    version: "1.0.0",
    generator: "@terrazzo/plugin-css@4.1.0",
    tokens: {
      "--color-background": {
        id: "color.background",
        type: "color",
        tier: "semantic",
        value: "#ffffff",
        valueLight: "#ffffff",
        valueDark: "#000000",
        isPaired: true,
        description: "Background token",
        sourceFile: "/tokens/color.tokens.json",
        sourceLine: 1,
        aliasChain: [],
        extensions: {},
        registered: false,
        syntax: null,
        inherits: null,
        initialValue: null,
        cssOutputFile: "tokens.css",
        cssOutputLine: 2,
      },
    },
  };
}

describe("loadConfiguredArtifacts", () => {
  it("loads configured artifacts into the token graph", async () => {
    const rootDir = await fs.mkdtemp(path.join(tmpdir(), "lsp-artifacts-"));
    const artifactPath = path.join(
      rootDir,
      "node_modules",
      "@acme",
      "tokens",
      "dist",
      "tokens.json",
    );
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, JSON.stringify(makeArtifact()), "utf8");

    const state = createServerState({
      postMessage: vi.fn(),
      rootDir,
    });
    state.config.artifactPaths = [artifactPath];

    await loadConfiguredArtifacts(state);

    const token = state.graph.resolveToken("--color-background");
    expect(token?.cssVar).toBe("--color-background");
    expect(token?.packageSource).toBe("@acme/tokens");
  });

  it("logs an error for missing or invalid artifacts", async () => {
    const rootDir = await fs.mkdtemp(path.join(tmpdir(), "lsp-artifacts-"));
    const missingPath = path.join(rootDir, "missing.json");
    const log = vi.fn();
    const state = createServerState({
      postMessage: vi.fn(),
      rootDir,
      log,
    });
    state.config.artifactPaths = [missingPath];

    await expect(loadConfiguredArtifacts(state)).resolves.toBeUndefined();
    expect(state.graph.tokenCount).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to load artifact: ${missingPath}`),
    );
  });
});

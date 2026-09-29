import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import createServerState from "../createServerState.js";
import handleArtifactChanged from "./handleArtifactChanged.js";

function makeArtifact(type: string | null) {
  return {
    version: "1.0.0",
    generator: "@terrazzo/plugin-css@4.1.0",
    tokens: {
      "--color-background": {
        id: "color.background",
        type,
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

describe("handleArtifactChanged", () => {
  it("reloads artifacts and publishes artifact diagnostics when needed", async () => {
    const rootDir = await fs.mkdtemp(
      path.join(tmpdir(), "lsp-artifact-change-"),
    );
    const artifactPath = path.join(rootDir, "tokens.json");
    await fs.writeFile(
      artifactPath,
      JSON.stringify(makeArtifact(null)),
      "utf8",
    );

    const postMessage = vi.fn();
    const state = createServerState({
      postMessage,
      rootDir,
    });
    const invalidateAll = vi.fn();
    state.cache.invalidateAll = invalidateAll;
    state.config.artifactPaths = [artifactPath];

    await handleArtifactChanged(state, {
      id: 5,
      type: "ARTIFACT_CHANGED",
      path: artifactPath,
      uri: pathToFileURL(artifactPath).href,
    });

    expect(invalidateAll).toHaveBeenCalled();
    expect(state.graph.tokenCount).toBe(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        type: "PUSH_DIAGNOSTICS",
        uri: pathToFileURL(artifactPath).href,
      }),
    );
  });

  it("publishes an empty array once the artifact errors are gone", async () => {
    const rootDir = await fs.mkdtemp(
      path.join(tmpdir(), "lsp-artifact-clean-"),
    );
    const artifactPath = path.join(rootDir, "tokens.json");
    // An artifact with nothing wrong with it produces no diagnostics. The
    // editor is still showing whatever the last publish said, so silence here
    // would leave stale errors on screen forever.
    await fs.writeFile(artifactPath, JSON.stringify({}), "utf8");

    const postMessage = vi.fn();
    const state = createServerState({ postMessage, rootDir });
    state.config.artifactPaths = [artifactPath];

    await handleArtifactChanged(state, {
      id: 6,
      type: "ARTIFACT_CHANGED",
      path: artifactPath,
      uri: pathToFileURL(artifactPath).href,
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 6,
        type: "PUSH_DIAGNOSTICS",
        uri: pathToFileURL(artifactPath).href,
        diagnostics: [],
      }),
    );
  });
});

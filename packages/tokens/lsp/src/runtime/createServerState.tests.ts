import { describe, expect, it, vi } from "vitest";
import createServerState from "./createServerState.js";

describe("createServerState", () => {
  it("initializes worker state with empty document maps and callbacks", () => {
    const debug = vi.fn();
    const log = vi.fn();
    const postMessage = vi.fn();

    const state = createServerState({
      debug,
      log,
      postMessage,
      rootDir: "/workspace/project",
    });

    expect(state.allowDegraded).toBe(false);
    expect(state.rootDir).toBe("/workspace/project");
    expect(state.config.artifactPaths).toEqual([]);
    expect(state.config.distDir).toBe("/workspace/project/dist");
    expect(state.configPromise).toBeNull();
    expect(state.debug).toBe(debug);
    expect(state.log).toBe(log);
    expect(state.postMessage).toBe(postMessage);
    expect(state.openDocuments.size).toBe(0);
    expect(state.openTrees.size).toBe(0);
    expect(state.pendingUpdates.size).toBe(0);
  });

  it("returns null when the filesystem adapter cannot read a file", async () => {
    const state = createServerState({
      postMessage: () => {},
      rootDir: "/workspace/project",
    });

    await expect(
      state.fs.readFile("file:///workspace/project/missing.css"),
    ).resolves.toBeNull();
  });
});

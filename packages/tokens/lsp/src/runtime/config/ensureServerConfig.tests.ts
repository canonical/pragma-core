import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import ConfigNotFoundError from "../ConfigNotFoundError.js";
import createServerState from "../createServerState.js";
import ensureServerConfig from "./ensureServerConfig.js";

describe("ensureServerConfig", () => {
  it("caches config loading and resolves config from disk", async () => {
    const rootDir = await fs.mkdtemp(path.join(tmpdir(), "lsp-config-"));
    await fs.writeFile(
      path.join(rootDir, "terrazzo-lsp.config.json"),
      JSON.stringify({}),
      "utf8",
    );
    const log = vi.fn();
    const state = createServerState({
      log,
      postMessage: vi.fn(),
      rootDir,
    });

    const first = ensureServerConfig(state);
    const second = ensureServerConfig(state);

    expect(first).toBe(second);
    await first;
    expect(state.config.distDir).toBe(path.join(rootDir, "dist"));
    expect(log).toHaveBeenCalledWith(
      `Config loaded from ${rootDir}/terrazzo-lsp.config.json`,
    );
    expect(log).toHaveBeenCalledWith("terrazzo-lsp ready");
  });

  it("throws when no config is found and degraded mode is disabled", async () => {
    const rootDir = await fs.mkdtemp(path.join(tmpdir(), "lsp-config-"));
    const state = createServerState({
      postMessage: vi.fn(),
      rootDir,
    });

    await expect(ensureServerConfig(state)).rejects.toBeInstanceOf(
      ConfigNotFoundError,
    );
  });
});

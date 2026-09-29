import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfigFile, resolveConfig } from "./resolveConfig.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveConfig", () => {
  it("resolves empty config with all defaults", () => {
    const resolved = resolveConfig({}, "/project");

    expect(resolved.artifactPaths).toEqual([]);
    expect(resolved.distDir).toBe("/project/dist");
    expect(resolved.scanGlobs).toEqual(["src/**/*.css", "src/**/*.scss"]);
    expect(resolved.globalStylesheets).toBeNull();
    expect(resolved.diagnosticIgnoreGlobs).toEqual([]);
    expect(resolved.hover.showColourSwatches).toBe(true);
    expect(resolved.hover.showProvenanceBadge).toBe(true);
    expect(resolved.inlayHints.enabled).toBe(false);
  });

  it("resolves a relative artifact path", () => {
    const resolved = resolveConfig(
      { artifacts: ["./dist/tokens.json"] },
      "/project",
    );
    expect(resolved.artifactPaths).toEqual(["/project/dist/tokens.json"]);
  });

  it("resolves a bare specifier through node_modules (fallback)", () => {
    // When no node_modules directory exists on disk, falls back to
    // <rootDir>/node_modules/<specifier>
    const resolved = resolveConfig(
      { artifacts: ["@canonical/design-tokens/dist/tokens.json"] },
      "/project",
    );
    expect(resolved.artifactPaths).toEqual([
      "/project/node_modules/@canonical/design-tokens/dist/tokens.json",
    ]);
  });

  it("resolves multiple artifact paths", () => {
    const resolved = resolveConfig(
      {
        artifacts: ["@canonical/tokens/dist/tokens.json", "./dist/tokens.json"],
      },
      "/project",
    );
    expect(resolved.artifactPaths).toEqual([
      "/project/node_modules/@canonical/tokens/dist/tokens.json",
      "/project/dist/tokens.json",
    ]);
  });

  it("drops artifact paths that escape the workspace root", () => {
    const resolved = resolveConfig(
      { artifacts: ["../../../../etc/passwd", "./dist/tokens.json"] },
      "/project",
    );
    // The traversal path is rejected; the in-root path survives.
    expect(resolved.artifactPaths).toEqual(["/project/dist/tokens.json"]);
  });

  it("drops globalStylesheets that escape the workspace root", () => {
    const resolved = resolveConfig(
      {
        globalStylesheets: ["/etc/shadow", "../secrets.css", "./tokens.css"],
      },
      "/project",
    );
    expect(resolved.globalStylesheets).toEqual(["file:///project/tokens.css"]);
  });

  it("keeps in-root paths when the workspace root is the filesystem root", () => {
    // Regression: containment must not reject /dist/... when rootDir is "/"
    // (root + sep would be "//", failing every startsWith check).
    const resolved = resolveConfig({ artifacts: ["./dist/tokens.json"] }, "/");
    expect(resolved.artifactPaths).toEqual(["/dist/tokens.json"]);
  });

  it("resolves distDir from config", () => {
    const resolved = resolveConfig({ distDir: "./build" }, "/project");
    expect(resolved.distDir).toBe("/project/build");
  });

  it("resolves scanGlobs override", () => {
    const resolved = resolveConfig({ scanGlobs: ["app/**/*.css"] }, "/project");
    expect(resolved.scanGlobs).toEqual(["app/**/*.css"]);
  });

  it("resolves globalStylesheets as explicit empty array", () => {
    const resolved = resolveConfig({ globalStylesheets: [] }, "/project");
    expect(resolved.globalStylesheets).toEqual([]);
  });

  it("resolves globalStylesheets with values", () => {
    const resolved = resolveConfig(
      {
        globalStylesheets: ["node_modules/@canonical/tokens/dist/**/*.css"],
      },
      "/project",
    );
    expect(resolved.globalStylesheets).toEqual([
      "file:///project/node_modules/@canonical/tokens/dist/**/*.css",
    ]);
  });

  it("resolves globalStylesheets bare specifier through node_modules (fallback)", () => {
    const resolved = resolveConfig(
      {
        globalStylesheets: ["@canonical/styles/src/index.css"],
      },
      "/project",
    );
    expect(resolved.globalStylesheets).toEqual([
      "file:///project/node_modules/@canonical/styles/src/index.css",
    ]);
  });

  it("resolves diagnostic severity overrides", () => {
    const resolved = resolveConfig(
      {
        diagnostics: {
          typeMismatch: "warning",
          missingFallback: "off",
        },
      },
      "/project",
    );
    expect(resolved.diagnostics.get("css/type-mismatch")).toBe(2); // Warning
    expect(resolved.diagnostics.get("css/missing-fallback")).toBeNull(); // off
  });

  it("resolves diagnostic ignoreGlobs", () => {
    const resolved = resolveConfig(
      {
        diagnostics: {
          ignoreGlobs: ["**/vendor/**"],
        },
      },
      "/project",
    );
    expect(resolved.diagnosticIgnoreGlobs).toEqual(["**/vendor/**"]);
  });

  it("resolves hover options", () => {
    const resolved = resolveConfig(
      {
        hover: {
          showColourSwatches: false,
          showAliasChain: false,
        },
      },
      "/project",
    );
    expect(resolved.hover.showColourSwatches).toBe(false);
    expect(resolved.hover.showAliasChain).toBe(false);
    // Other hover options retain defaults
    expect(resolved.hover.showProvenanceBadge).toBe(true);
  });

  it("resolves inlay hints options", () => {
    const resolved = resolveConfig(
      {
        inlayHints: {
          enabled: true,
        },
      },
      "/project",
    );
    expect(resolved.inlayHints.enabled).toBe(true);
    expect(resolved.inlayHints.showColourSwatches).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadConfigFile — walks up directory tree
// ---------------------------------------------------------------------------

describe("loadConfigFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "terrazzo-cfg-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("finds config in the start directory", async () => {
    const config = { artifacts: ["@pkg/tokens/dist/tokens.json"] };
    await fs.writeFile(
      path.join(tmpDir, "terrazzo-lsp.config.json"),
      JSON.stringify(config),
    );

    const result = await loadConfigFile(tmpDir);
    expect(result.configDir).toBe(tmpDir);
    expect(result.raw.artifacts).toEqual(["@pkg/tokens/dist/tokens.json"]);
    expect(result.searchedPaths).toEqual([
      path.join(tmpDir, "terrazzo-lsp.config.json"),
    ]);
  });

  it("finds config in a parent directory", async () => {
    const config = { artifacts: ["./dist/tokens.json"] };
    await fs.writeFile(
      path.join(tmpDir, "terrazzo-lsp.config.json"),
      JSON.stringify(config),
    );
    const child = path.join(tmpDir, "packages", "app");
    await fs.mkdir(child, { recursive: true });

    const result = await loadConfigFile(child);
    expect(result.configDir).toBe(tmpDir);
    expect(result.raw.artifacts).toEqual(["./dist/tokens.json"]);
    expect(result.searchedPaths).toEqual([
      path.join(child, "terrazzo-lsp.config.json"),
      path.join(tmpDir, "packages", "terrazzo-lsp.config.json"),
      path.join(tmpDir, "terrazzo-lsp.config.json"),
    ]);
  });

  it("returns empty config when no config file exists", async () => {
    const result = await loadConfigFile(tmpDir);
    expect(result.configDir).toBeNull();
    expect(result.raw).toEqual({});
    expect(result.searchedPaths[0]).toBe(
      path.join(tmpDir, "terrazzo-lsp.config.json"),
    );
  });

  it("stops at the nearest config file", async () => {
    // Place config at root
    await fs.writeFile(
      path.join(tmpDir, "terrazzo-lsp.config.json"),
      JSON.stringify({ artifacts: ["root-tokens.json"] }),
    );
    // Place another config in a subdirectory
    const sub = path.join(tmpDir, "packages", "app");
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(
      path.join(sub, "terrazzo-lsp.config.json"),
      JSON.stringify({ artifacts: ["app-tokens.json"] }),
    );

    const result = await loadConfigFile(sub);
    // Should find the closest one (in sub), not the root one
    expect(result.configDir).toBe(sub);
    expect(result.raw.artifacts).toEqual(["app-tokens.json"]);
    expect(result.searchedPaths).toEqual([
      path.join(sub, "terrazzo-lsp.config.json"),
    ]);
  });
});

// ---------------------------------------------------------------------------
// resolveConfig — bare specifier walk-up (real filesystem)
// ---------------------------------------------------------------------------

describe("resolveConfig bare specifier walk-up", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "terrazzo-walkup-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("finds a hoisted package in a parent node_modules", async () => {
    // Simulate monorepo layout:
    //   tmpDir/node_modules/@canonical/design-tokens/dist/tokens.json
    //   tmpDir/packages/app/  <-- config lives here
    const hoistedPkg = path.join(
      tmpDir,
      "node_modules/@canonical/design-tokens/dist",
    );
    await fs.mkdir(hoistedPkg, { recursive: true });
    await fs.writeFile(path.join(hoistedPkg, "tokens.json"), "{}");

    const configDir = path.join(tmpDir, "packages", "app");
    await fs.mkdir(configDir, { recursive: true });

    const resolved = resolveConfig(
      { artifacts: ["@canonical/design-tokens/dist/tokens.json"] },
      configDir,
    );

    expect(resolved.artifactPaths).toEqual([
      path.join(
        tmpDir,
        "node_modules/@canonical/design-tokens/dist/tokens.json",
      ),
    ]);
  });

  it("resolves globalStylesheet bare specifier from hoisted node_modules", async () => {
    const hoistedPkg = path.join(tmpDir, "node_modules/@canonical/styles/src");
    await fs.mkdir(hoistedPkg, { recursive: true });
    await fs.writeFile(path.join(hoistedPkg, "index.css"), "");

    const configDir = path.join(tmpDir, "packages", "app");
    await fs.mkdir(configDir, { recursive: true });

    const resolved = resolveConfig(
      { globalStylesheets: ["@canonical/styles/src/index.css"] },
      configDir,
    );

    expect(resolved.globalStylesheets).toEqual([
      `file://${path.join(tmpDir, "node_modules/@canonical/styles/src/index.css")}`,
    ]);
  });

  it("prefers a closer node_modules over a hoisted one", async () => {
    // Both exist: local and hoisted
    const hoisted = path.join(tmpDir, "node_modules/@pkg/tokens/dist");
    const local = path.join(
      tmpDir,
      "packages/app/node_modules/@pkg/tokens/dist",
    );
    await fs.mkdir(hoisted, { recursive: true });
    await fs.mkdir(local, { recursive: true });
    await fs.writeFile(path.join(hoisted, "tokens.json"), "{}");
    await fs.writeFile(path.join(local, "tokens.json"), "{}");

    const configDir = path.join(tmpDir, "packages", "app");

    const resolved = resolveConfig(
      { artifacts: ["@pkg/tokens/dist/tokens.json"] },
      configDir,
    );

    expect(resolved.artifactPaths).toEqual([path.join(local, "tokens.json")]);
  });
});

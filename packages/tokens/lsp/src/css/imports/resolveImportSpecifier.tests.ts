import { describe, expect, it } from "vitest";
import resolveImportSpecifier from "./resolveImportSpecifier.js";

describe("resolveImportSpecifier", () => {
  const workspaceRoot = "/project";

  it("resolves relative paths against importer directory", () => {
    const result = resolveImportSpecifier(
      "./Button.local.css",
      "/project/src/components/Button/Button.css",
      workspaceRoot,
    );
    expect(result).toBe("/project/src/components/Button/Button.local.css");
  });

  it("resolves parent-relative paths", () => {
    const result = resolveImportSpecifier(
      "../../global.css",
      "/project/src/components/Button/Button.css",
      workspaceRoot,
    );
    expect(result).toBe("/project/src/global.css");
  });

  it("resolves absolute paths within the workspace root", () => {
    const result = resolveImportSpecifier(
      "/project/src/global.css",
      "/project/src/a.css",
      workspaceRoot,
    );
    expect(result).toBe("/project/src/global.css");
  });

  it("rejects absolute paths outside the workspace root", () => {
    expect(
      resolveImportSpecifier(
        "/etc/passwd",
        "/project/src/a.css",
        workspaceRoot,
      ),
    ).toBeNull();
  });

  it("rejects parent-relative paths that escape the workspace root", () => {
    expect(
      resolveImportSpecifier(
        "../../../../etc/passwd",
        "/project/src/a.css",
        workspaceRoot,
      ),
    ).toBeNull();
  });

  it("returns null for HTTP URLs", () => {
    expect(
      resolveImportSpecifier(
        "https://example.com/styles.css",
        "/project/src/a.css",
        workspaceRoot,
      ),
    ).toBeNull();
  });

  it("returns null for data URIs", () => {
    expect(
      resolveImportSpecifier(
        "data:text/css,body{}",
        "/project/src/a.css",
        workspaceRoot,
      ),
    ).toBeNull();
  });

  it("resolves bare specifiers to node_modules", () => {
    const result = resolveImportSpecifier(
      "@canonical/tokens/dist/tokens.css",
      "/project/src/global.css",
      workspaceRoot,
    );
    expect(result).toBe(
      "/project/node_modules/@canonical/tokens/dist/tokens.css",
    );
  });

  it("resolves unscoped bare specifiers to node_modules", () => {
    const result = resolveImportSpecifier(
      "normalize.css",
      "/project/src/global.css",
      workspaceRoot,
    );
    expect(result).toBe("/project/node_modules/normalize.css");
  });
});

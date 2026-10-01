import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, "package.json"), "utf8"),
) as {
  bin: Record<string, string>;
  files: string[];
  exports: Record<string, unknown>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("what the package ships", () => {
  it("exports the whole of definitions/ as a subpath", () => {
    // An `exports` map blocks every subpath it does not list with
    // ERR_PACKAGE_PATH_NOT_EXPORTED, and this package's map listed "." alone
    // until 0.4.0. The consequence of the fix is worth stating: every file
    // under definitions/ is public API, so adding one is an API addition.
    expect(manifest.exports["./definitions/*"]).toBe("./definitions/*");
    expect(manifest.files).toContain("definitions");
  });

  it("declares yaml as a runtime dependency, not a dev one", () => {
    // src/document/parseAnatomyDocument.ts loads it — the value grammar runs
    // over the parsed document — and design-system calls this package in
    // process.
    expect(manifest.dependencies.yaml).toBeDefined();
    expect(manifest.devDependencies.yaml).toBeUndefined();
    expect(
      readFileSync(
        resolve(ROOT, "src", "document", "parseAnatomyDocument.ts"),
        "utf8",
      ),
    ).toContain('from "yaml"');
  });

  it("keeps the generators out of the published build", () => {
    // They read the repository rather than the package — the roster and the
    // example pairs — and nothing a consumer imports imports them.
    const build = JSON.parse(
      readFileSync(resolve(ROOT, "tsconfig.build.json"), "utf8"),
    ) as { exclude: string[] };
    expect(build.exclude).toContain("src/registry.ts");
    expect(build.exclude).toContain("src/generate.ts");
  });

  it("reads no CSS, and installs no component library", () => {
    // This package is a meta-model: YAML in, Turtle out. The property census
    // and the CSS reader that fed it live in canonical/design-system, where
    // the reference stylesheets are already an input, so nothing here opens
    // a stylesheet and nothing here installs a component library to find one
    // in.
    const declared = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };
    for (const name of ["postcss", "css-tree", "csstree", "stylis", "sass"]) {
      expect(declared[name], name).toBeUndefined();
    }
    for (const name of Object.keys(declared)) {
      expect(name, name).not.toMatch(/-ds-/);
    }
    const modules = readdirSync(resolve(ROOT, "src")).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );
    for (const module of modules) {
      const source = readFileSync(resolve(ROOT, "src", module), "utf8");
      for (const trace of [
        ".css",
        "readDeclarations",
        "extractLitCss",
        "postcss",
      ]) {
        expect(source, `${module} → ${trace}`).not.toContain(trace);
      }
    }
    expect(existsSync(resolve(ROOT, "src", "stylesheet.ts"))).toBe(false);
    expect(existsSync(resolve(ROOT, "src", "census.ts"))).toBe(false);
  });

  it("ships the check command as a built bin", () => {
    // The bin points into dist/, so it runs under node from an installed
    // package, and it exists only while the build compiles src/cli.ts.
    expect(manifest.bin["anatomy-dsl"]).toBe("./dist/esm/cli.js");
    const build = JSON.parse(
      readFileSync(resolve(ROOT, "tsconfig.build.json"), "utf8"),
    ) as { exclude: string[] };
    expect(build.exclude).not.toContain("src/cli.ts");
    expect(readFileSync(resolve(ROOT, "src", "cli.ts"), "utf8")).toMatch(
      /^#!\/usr\/bin\/env node\n/,
    );
  });
});

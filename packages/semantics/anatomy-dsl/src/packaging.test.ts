import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(ROOT, "package.json"), "utf8"),
) as {
  files: string[];
  exports: Record<string, unknown>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/**
 * The tarball's file list, as npm would publish it — computed once, because
 * `npm pack` takes over a second and the file list cannot change mid-run.
 */
let packed: string[] | undefined;
function packedFiles(): string[] {
  if (packed !== undefined) return packed;
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const [entry] = JSON.parse(out) as { files: { path: string }[] }[];
  packed = (entry?.files ?? []).map((file) => file.path);
  return packed;
}

describe("what the package ships", () => {
  it("carries the definition files design-system imports", () => {
    // design-system reads these from the package and never copies them, so
    // one of them missing from the tarball is a silent divergence between
    // the two repositories rather than a build error.
    const files = packedFiles();
    expect(files).toContain("definitions/style-keys.yaml");
    expect(files).toContain("definitions/registry.ttl");
    expect(files).toContain("definitions/lift.fixture.json");
    expect(files).toContain("definitions/ontology.ttl");
    expect(files).toContain("definitions/shapes.ttl");
  });

  it("exports the whole of definitions/ as a subpath", () => {
    // An `exports` map blocks every subpath it does not list with
    // ERR_PACKAGE_PATH_NOT_EXPORTED, and this package's map listed "." alone
    // until 0.4.0. The consequence of the fix is worth stating: every file
    // under definitions/ is public API, so adding one is an API addition.
    expect(manifest.exports["./definitions/*"]).toBe("./definitions/*");
    expect(manifest.files).toContain("definitions");
  });

  it("declares yaml as a runtime dependency, not a dev one", () => {
    // src/parse.ts loads it — the value grammar runs over the parsed
    // document — and design-system calls this package in process.
    expect(manifest.dependencies.yaml).toBeDefined();
    expect(manifest.devDependencies.yaml).toBeUndefined();
    expect(readFileSync(resolve(ROOT, "src", "parse.ts"), "utf8")).toContain(
      'from "yaml"',
    );
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

  it("ships the entry point the exports map promises, once built", () => {
    // `bun run build` runs before `bun run test` in CI; locally the dist may
    // be absent, and this assertion is then vacuous by design rather than
    // red for the wrong reason.
    if (!existsSync(resolve(ROOT, "dist", "esm", "index.js"))) return;
    expect(packedFiles()).toContain("dist/esm/index.js");
  });
});

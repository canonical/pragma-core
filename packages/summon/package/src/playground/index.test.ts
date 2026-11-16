/**
 * Tests for the playground generator (dry-run)
 */

import { dryRun, dryRunWith } from "@canonical/task";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json" with { type: "json" };
import { type PlaygroundAnswers, PRAGMA_WEB_VERSION } from "../shared/index.js";
import { generator } from "./index.js";

const answers = (overrides: Partial<PlaygroundAnswers> = {}) =>
  ({
    playgroundPath: "my-playground",
    framework: "react",
    dsGlobal: true,
    dsGlobalForm: true,
    dsApp: false,
    runInstall: false,
    ...overrides,
  }) satisfies PlaygroundAnswers;

interface WriteFile {
  _tag: "WriteFile";
  path: string;
  content: string;
}

/** Every file the generator writes, by path. */
const files = (input: PlaygroundAnswers): Map<string, string> =>
  new Map(
    dryRun(generator.generate(input))
      .effects.filter((e): e is WriteFile => e._tag === "WriteFile")
      .map((e) => [e.path, e.content]),
  );

const manifest = (written: Map<string, string>, dir = "my-playground") =>
  JSON.parse(written.get(`${dir}/package.json`) ?? "{}") as {
    name: string;
    private: boolean;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

describe("playground generator", () => {
  it("has correct meta information", () => {
    expect(generator.meta.name).toBe("playground");
    expect(generator.meta.version).toBe(pkg.version);
  });

  it("asks for the directory as a positional answer", () => {
    const path = generator.prompts.find((p) => p.name === "playgroundPath");
    expect(path?.positional).toBe(true);
    expect(path?.default).toBe("playground");
  });

  it("asks for the form fields on React only", () => {
    const forms = generator.prompts.find((p) => p.name === "dsGlobalForm");
    expect(forms?.when?.({ framework: "react" })).toBe(true);
    expect(forms?.when?.({ framework: "svelte" })).toBe(false);
  });

  it("writes a React playground with Storybook and a sample component", () => {
    const written = files(answers());
    expect([...written.keys()].sort()).toEqual([
      "my-playground/.gitignore",
      "my-playground/.storybook/main.ts",
      "my-playground/.storybook/preview.ts",
      "my-playground/.storybook/styles.css",
      "my-playground/README.md",
      "my-playground/biome.json",
      "my-playground/package.json",
      "my-playground/src/Prototype/Prototype.stories.tsx",
      "my-playground/src/Prototype/Prototype.tsx",
      "my-playground/src/Prototype/index.ts",
      "my-playground/src/Prototype/styles.css",
      "my-playground/src/Prototype/types.ts",
      "my-playground/tsconfig.json",
    ]);
    expect(written.get("my-playground/.storybook/main.ts")).toContain(
      'createConfig("react")',
    );
  });

  it("writes a Svelte playground with the Vite plugin Storybook needs", () => {
    const written = files(
      answers({ framework: "svelte", dsGlobalForm: undefined }),
    );
    expect(written.has("my-playground/vite.config.ts")).toBe(true);
    expect(written.has("my-playground/svelte.config.js")).toBe(true);
    expect(
      written.has("my-playground/src/Prototype/Prototype.stories.svelte"),
    ).toBe(true);
    expect(written.get("my-playground/.storybook/main.ts")).toContain(
      'createConfig("svelte")',
    );
  });

  it("installs the chosen React design-system packages at the pragma-web line", () => {
    const deps = manifest(files(answers({ dsApp: true }))).dependencies;
    const range = `^${PRAGMA_WEB_VERSION}`;
    expect(deps["@canonical/styles"]).toBe(range);
    expect(deps["@canonical/react-ds-global"]).toBe(range);
    expect(deps["@canonical/react-ds-global-form"]).toBe(range);
    expect(deps["@canonical/react-ds-app"]).toBe(range);
    // react-ds-app's routing components take the router as a peer.
    expect(deps["@canonical/router-react"]).toBe(range);
  });

  it("leaves out every package that is toggled off", () => {
    const written = files(
      answers({ dsGlobal: false, dsGlobalForm: false, dsApp: false }),
    );
    expect(Object.keys(manifest(written).dependencies).sort()).toEqual([
      "@canonical/styles",
      "react",
      "react-dom",
    ]);
    const sources = [...written.values()].join("\n");
    expect(sources).not.toContain("react-ds-global");
    expect(sources).not.toContain("react-ds-app");
  });

  it("loads the form stylesheet only when the form fields are installed", () => {
    const styles = (input: PlaygroundAnswers) =>
      files(input).get("my-playground/.storybook/styles.css");
    expect(styles(answers())).toContain("react-ds-global-form");
    expect(styles(answers({ dsGlobalForm: false }))).not.toContain(
      "react-ds-global-form",
    );
  });

  it("never installs a form package for Svelte", () => {
    const deps = manifest(
      files(answers({ framework: "svelte", dsGlobalForm: undefined })),
    ).dependencies;
    expect(Object.keys(deps).sort()).toEqual([
      "@canonical/styles",
      "@canonical/svelte-ds-global",
      "svelte",
    ]);
  });

  it("ignores the form answer on Svelte, whichever front-end filled it", () => {
    // summon's CLI fills a `when`-false prompt's default; pragma's does not.
    const deps = manifest(
      files(answers({ framework: "svelte", dsGlobalForm: true })),
    ).dependencies;
    expect(Object.keys(deps)).not.toContain("@canonical/react-ds-global-form");
  });

  it("names the package after the directory's last segment", () => {
    const written = files(answers({ playgroundPath: "prototypes/Navigation" }));
    expect(manifest(written, "prototypes/Navigation").name).toBe("navigation");
  });

  it("is private and starts Storybook from its scripts", () => {
    const m = manifest(files(answers()));
    expect(m.private).toBe(true);
    expect(m.scripts.storybook).toBe("storybook dev -p 6006");
  });

  it("refuses to generate into an existing directory", () => {
    const existing = new Map([["Exists", () => true]]);
    expect(() => dryRunWith(generator.generate(answers()), existing)).toThrow(
      /already exists/,
    );
  });
});

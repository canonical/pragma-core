/**
 * Tests for the playground generator (dry-run)
 */

import {
  dryRun,
  dryRunWith,
  type Effect,
  TaskExecutionError,
} from "@canonical/task";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json" with { type: "json" };
import { type PlaygroundAnswers, PRAGMA_WEB_VERSION } from "../shared/index.js";
import { generator } from "./index.js";

const answers = (overrides: Partial<PlaygroundAnswers> = {}) =>
  ({
    playgroundPath: "my-playground",
    framework: "react",
    packages: ["ds-global", "ds-global-form"],
    gitInit: true,
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

  it("offers the design-system packages as one multi-select", () => {
    const packages = generator.prompts.find((p) => p.name === "packages");
    expect(packages?.type).toBe("multiselect");
    expect(packages?.choices?.map((c) => c.value)).toEqual([
      "ds-global",
      "ds-global-form",
      "ds-app",
    ]);
    expect(packages?.default).toEqual(["ds-global", "ds-global-form"]);
    // The styles are not a choice: they are always installed, and the
    // question says so.
    expect(packages?.message).toContain("styles always included");
  });

  it("always installs and loads @canonical/styles", () => {
    const written = files(answers({ packages: [] }));
    expect(manifest(written).dependencies["@canonical/styles"]).toBe(
      `^${PRAGMA_WEB_VERSION}`,
    );
    expect(written.get("my-playground/.storybook/styles.css")).toContain(
      '@import url("@canonical/styles");',
    );
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
      answers({ framework: "svelte", packages: ["ds-global"] }),
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
    const deps = manifest(
      files(answers({ packages: ["ds-global", "ds-global-form", "ds-app"] })),
    ).dependencies;
    const range = `^${PRAGMA_WEB_VERSION}`;
    expect(deps["@canonical/styles"]).toBe(range);
    expect(deps["@canonical/react-ds-global"]).toBe(range);
    expect(deps["@canonical/react-ds-global-form"]).toBe(range);
    expect(deps["@canonical/react-ds-app"]).toBe(range);
    // react-ds-app's routing components take the router as a peer.
    expect(deps["@canonical/router-react"]).toBe(range);
  });

  it("leaves out every package that is toggled off", () => {
    const written = files(answers({ packages: [] }));
    expect(Object.keys(manifest(written).dependencies).sort()).toEqual([
      "@canonical/styles",
      "react",
      "react-dom",
    ]);
    const sources = [...written.values()].join("\n");
    expect(sources).not.toContain("react-ds-global");
    expect(sources).not.toContain("react-ds-app");
  });

  it("installs the form fields with their stylesheet, and neither without them", () => {
    const formStylesheet =
      '@import url("@canonical/react-ds-global-form/dist/esm/index.css");';
    const withForm = files(answers());
    expect(
      manifest(withForm).dependencies["@canonical/react-ds-global-form"],
    ).toBe(`^${PRAGMA_WEB_VERSION}`);
    expect(withForm.get("my-playground/.storybook/styles.css")).toContain(
      formStylesheet,
    );

    const without = files(answers({ packages: ["ds-global"] }));
    expect(manifest(without).dependencies).not.toHaveProperty(
      "@canonical/react-ds-global-form",
    );
    expect(without.get("my-playground/.storybook/styles.css")).not.toContain(
      "react-ds-global-form",
    );
  });

  it("never installs a form package for Svelte", () => {
    const deps = manifest(
      files(answers({ framework: "svelte", packages: ["ds-global"] })),
    ).dependencies;
    expect(Object.keys(deps).sort()).toEqual([
      "@canonical/styles",
      "@canonical/svelte-ds-global",
      "svelte",
    ]);
  });

  it("skips the form package on Svelte, where it is in the default selection", () => {
    // ds-global-form is in the default selection, so every Svelte run that
    // takes the defaults carries it.
    const deps = manifest(
      files(
        answers({
          framework: "svelte",
          packages: ["ds-global", "ds-global-form"],
        }),
      ),
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

  describe("git init", () => {
    interface ExecEffect {
      _tag: "Exec";
      command: string;
      args: string[];
      cwd?: string;
    }
    // dryRunWith answers `Exists` with true unless told otherwise, which
    // would trip the existing-directory guard.
    const fresh = ["Exists", () => false] as const;
    const gitCalls = (effects: Effect[]) =>
      effects
        .filter((e): e is ExecEffect & Effect => e._tag === "Exec")
        .filter((e) => e.command === "git")
        .map((e) => `${e.args.join(" ")} @ ${e.cwd}`);

    it("is a confirm that defaults to yes", () => {
      const git = generator.prompts.find((p) => p.name === "gitInit");
      expect(git?.type).toBe("confirm");
      expect(git?.default).toBe(true);
    });

    it("initialises a repository in the playground", () => {
      const { effects } = dryRun(generator.generate(answers()));
      expect(gitCalls(effects)).toEqual([
        "rev-parse --is-inside-work-tree @ my-playground",
        "init --quiet @ my-playground",
      ]);
    });

    it("runs no git command when turned off", () => {
      const { effects } = dryRun(
        generator.generate(answers({ gitInit: false })),
      );
      expect(gitCalls(effects)).toEqual([]);
    });

    it("skips init inside an existing repository", () => {
      const insideRepo = new Map<string, (e: Effect) => unknown>([
        fresh,
        [
          "Exec",
          (e: Effect) => ({
            stdout: (e as ExecEffect).args[0] === "rev-parse" ? "true\n" : "",
            stderr: "",
            exitCode: 0,
          }),
        ],
      ]);
      const { effects } = dryRunWith(generator.generate(answers()), insideRepo);
      expect(gitCalls(effects)).toEqual([
        "rev-parse --is-inside-work-tree @ my-playground",
      ]);
    });

    it("carries on without a repository when git is missing", () => {
      const noGit = new Map<string, (e: Effect) => unknown>([
        fresh,
        [
          "Exec",
          () => {
            throw new TaskExecutionError({
              code: "EXEC_FAILED",
              message: "spawn git ENOENT",
            });
          },
        ],
      ]);
      const { effects } = dryRunWith(generator.generate(answers()), noGit);
      // The files are still written, and nothing after the probe ran.
      expect(effects.some((e) => e._tag === "WriteFile")).toBe(true);
      expect(gitCalls(effects)).toEqual([
        "rev-parse --is-inside-work-tree @ my-playground",
      ]);
    });

    it("removes the repository it created on undo", () => {
      const { effects } = dryRun(generator.generate(answers()));
      const init = effects.find(
        (e) => e._tag === "Exec" && (e as ExecEffect).args[0] === "init",
      ) as { undo?: unknown } | undefined;
      expect(JSON.stringify(init?.undo)).toContain("my-playground/.git");
    });
  });
});

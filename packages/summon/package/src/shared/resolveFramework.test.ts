import { describe, expect, it } from "vitest";
import resolveFramework, { resolveAnswers } from "./resolveFramework.js";
import type { PackageAnswers } from "./types.js";

describe("resolveFramework", () => {
  it("leaves a coherent answer set untouched", () => {
    expect(
      resolveFramework({
        type: "library",
        framework: "svelte",
        withCli: false,
      }),
    ).toEqual({ framework: "svelte", withCli: false, warnings: [] });
  });

  it("keeps a CLI on a react library — tsc emits the bin", () => {
    expect(
      resolveFramework({ type: "library", framework: "react", withCli: true }),
    ).toEqual({ framework: "react", withCli: true, warnings: [] });
  });

  it.each(["react", "svelte"] as const)(
    "drops %s on a tool-ts package, with a warning",
    (framework) => {
      const result = resolveFramework({
        type: "tool-ts",
        framework,
        withCli: false,
      });

      expect(result.framework).toBe("none");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(`--framework=${framework}`);
      expect(result.warnings[0]).toContain("tool-ts");
    },
  );

  it("drops a framework on a css package, with a warning", () => {
    const result = resolveFramework({
      type: "css",
      framework: "react",
      withCli: false,
    });

    expect(result.framework).toBe("none");
    expect(result.warnings).toHaveLength(1);
  });

  it("drops --with-cli from a svelte library, keeping the framework", () => {
    // The framework shaped the whole package; the CLI entry point is the
    // incidental extra, and svelte-package would never emit it.
    const result = resolveFramework({
      type: "library",
      framework: "svelte",
      withCli: true,
    });

    expect(result.framework).toBe("svelte");
    expect(result.withCli).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("--with-cli");
  });

  it("keeps a CLI once the framework itself has been coerced away", () => {
    // svelte + tool-ts + cli: the framework goes, so the CLI is no longer in
    // conflict with anything and survives — one warning, not two.
    const result = resolveFramework({
      type: "tool-ts",
      framework: "svelte",
      withCli: true,
    });

    expect(result).toEqual({
      framework: "none",
      withCli: true,
      warnings: [expect.stringContaining("library packages only")],
    });
  });
});

describe("resolveAnswers", () => {
  const answers: PackageAnswers = {
    name: "@canonical/my-pkg",
    type: "css",
    description: "",
    framework: "react",
    withStorybook: false,
    withCli: false,
    withPrTemplate: false,
    runInstall: false,
  };

  it("returns answers carrying the coerced values", () => {
    const result = resolveAnswers(answers);

    expect(result.answers.framework).toBe("none");
    expect(result.answers.name).toBe("@canonical/my-pkg");
    expect(result.warnings).toHaveLength(1);
  });

  it("folds --with-react into the react framework, with a deprecation warning", () => {
    const result = resolveAnswers({
      ...answers,
      type: "library",
      framework: "none",
      withReact: true,
    });

    expect(result.answers.framework).toBe("react");
    expect(result.warnings[0]).toContain("--with-react is deprecated");
    expect(result.warnings[0]).toContain("--framework=react");
  });

  it("keeps an explicit react framework and still deprecates --with-react", () => {
    const result = resolveAnswers({
      ...answers,
      type: "library",
      framework: "react",
      withReact: true,
    });

    expect(result.answers.framework).toBe("react");
    expect(result.warnings).toEqual([
      expect.stringContaining("--with-react is deprecated"),
    ]);
  });

  it("lets --framework win over the legacy flag, naming the ignored alias", () => {
    const result = resolveAnswers({
      ...answers,
      type: "library",
      framework: "svelte",
      withReact: true,
    });

    expect(result.answers.framework).toBe("svelte");
    expect(
      result.warnings.some((warning) =>
        warning.includes("Ignoring --with-react"),
      ),
    ).toBe(true);
  });

  it("ignores a false legacy flag", () => {
    const result = resolveAnswers({
      ...answers,
      type: "library",
      framework: "none",
      withReact: false,
    });

    expect(result.answers.framework).toBe("none");
    expect(result.warnings).toHaveLength(0);
  });
});

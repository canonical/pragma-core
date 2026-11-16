import { produceReference } from "@canonical/summon-core/testing";
import { dryRun } from "@canonical/task";
import { describe, expect, it } from "vitest";
import { pickPackageManager } from "../../shared/packageManager.js";
import { formatWithBiome } from "../../testing/formatWithBiome.js";
import { generator } from "./index.js";

describe("Svelte application generator", () => {
  it("renders native form controls with no form package", async () => {
    const tree = await produceReference({
      generator,
      answers: {
        appPath: "my-app",
        rendering: "ssr",
        forms: true,
        appShell: true,
        intl: false,
        runInstall: false,
      },
    });
    expect(tree.get("my-app/src/routes/contact/+page.svelte")).toContain(
      "<input id={field.name}",
    );
    expect(
      tree.get("my-app/src/routes/dashboard/settings/+page.svelte"),
    ).toContain('type="checkbox" role="switch"');
    for (const [file, content] of tree) {
      expect(content, file).not.toContain("svelte-ds-global-form");
    }
  });
  it("uses the published i18n-core API names", async () => {
    const tree = await produceReference({
      generator,
      answers: {
        appPath: "my-app",
        rendering: "ssr",
        forms: false,
        appShell: false,
        intl: true,
        runInstall: false,
      },
    });
    expect(tree.get("my-app/src/hooks.server.ts")).toContain(
      "getDocumentAttributes(config, event.locals.locale)",
    );
    expect(tree.get("my-app/src/routes/catalog/+page.svelte")).toContain(
      "createFormatters($locale).formatNumber(",
    );
  });
  it("offers native forms by default and no form-package option", () => {
    expect(
      generator.prompts.find((prompt) => prompt.name === "forms")?.default,
    ).toBe(true);
    expect(generator.prompts.map((prompt) => prompt.name)).toEqual([
      "appPath",
      "forms",
      "appShell",
      "intl",
      "rendering",
      "runInstall",
    ]);
  });
  it("installs dependencies when a package manager is available", () => {
    const result = dryRun(
      generator.generate({
        appPath: "field-app",
        forms: true,
        appShell: true,
        intl: false,
        rendering: "ssr",
        runInstall: true,
      }),
    );
    expect(result.effects.some((effect) => effect._tag === "Exec")).toBe(
      pickPackageManager() !== null,
    );
  });
  for (const rendering of ["ssr", "spa"] as const) {
    for (const forms of [false, true]) {
      for (const appShell of [false, true]) {
        for (const intl of [false, true]) {
          it(`${rendering}, forms=${forms}, shell=${appShell}, intl=${intl}`, async () => {
            const tree = await produceReference({
              generator,
              answers: {
                appPath: "my-app",
                rendering,
                forms,
                appShell,
                intl,
                runInstall: false,
              },
            });
            const files = [...tree.keys()];
            const sources = Object.fromEntries(
              [...tree]
                .filter(([file]) => /\.(ts|js|json)$/.test(file))
                .map(([file, content]) => [file, content]),
            );
            expect(formatWithBiome(sources).failures).toBeNull();
            const has = (file: string) => tree.has(`my-app/${file}`);
            const manifest = JSON.parse(tree.get("my-app/package.json") ?? "");
            expect(has("src/routes/+page.svelte")).toBe(true);
            expect(has("src/routes/contact/+page.svelte")).toBe(forms);
            expect(has("src/routes/contact/+page.server.ts")).toBe(
              forms && rendering === "ssr",
            );
            expect(has("src/routes/dashboard/+page.svelte")).toBe(appShell);
            expect(has("src/routes/account/+page.svelte")).toBe(appShell);
            expect(has("src/routes/login/+page.svelte")).toBe(appShell);
            expect(has("src/routes/account/+page.server.ts")).toBe(
              appShell && rendering === "ssr",
            );
            expect(has("src/lib/ContactExample.stories.svelte")).toBe(forms);
            expect(has(".storybook/main.ts")).toBe(true);
            expect(has("src/lib/i18n.ts")).toBe(intl);
            expect(has("src/hooks.server.ts")).toBe(rendering === "ssr");
            expect(has("src/routes/sitemap.xml/+server.ts")).toBe(
              rendering === "ssr",
            );
            expect(has("src/routes/dashboard/settings/+page.svelte")).toBe(
              appShell,
            );
            expect(has("src/lib/ProjectDanger.svelte")).toBe(appShell);
            expect(
              has("src/routes/dashboard/settings/confirm/+page.svelte"),
            ).toBe(appShell);
            expect(
              has("src/routes/dashboard/settings/confirm/+page.server.ts"),
            ).toBe(appShell && rendering === "ssr");
            expect(has("src/routes/dashboard/settings/+page.server.ts")).toBe(
              appShell && forms && rendering === "ssr",
            );
            expect(has("src/routes/dashboard/instances/+page.server.ts")).toBe(
              appShell && forms && rendering === "ssr",
            );
            expect(
              has("src/routes/dashboard/instances/remove/+page.server.ts"),
            ).toBe(appShell && forms && rendering === "ssr");
            expect(has("src/lib/instances.ts")).toBe(appShell && forms);
            expect(has("src/routes/+layout.ts")).toBe(rendering === "spa");
            expect(files.some((file) => file.endsWith(".tsx"))).toBe(false);
            expect(files.some((file) => /graphql|relay/i.test(file))).toBe(
              false,
            );
            expect(
              manifest.dependencies["@canonical/svelte-ds-app"] !== undefined,
            ).toBe(appShell);
            expect(
              manifest.dependencies["@canonical/i18n-core"] !== undefined,
            ).toBe(intl);
            expect(JSON.stringify(manifest)).not.toMatch(
              /react|relay|graphql/i,
            );
            expect(JSON.stringify(manifest)).not.toContain(
              "svelte-ds-global-form",
            );
          });
        }
      }
    }
  }
});

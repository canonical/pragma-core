import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { produceReference } from "@canonical/summon-core/testing";
import { dryRun } from "@canonical/task";
import { describe, expect, it } from "vitest";
import { pickPackageManager } from "../../shared/packageManager.js";
import { formatWithBiome } from "../../testing/formatWithBiome.js";
import { generator } from "./index.js";

const produce = (
  answers: Partial<Parameters<typeof generator.generate>[0]> = {},
) =>
  produceReference({
    generator,
    answers: {
      appPath: "my-app",
      rendering: "ssr",
      forms: true,
      appShell: true,
      intl: false,
      runInstall: false,
      ...answers,
    },
  });

const routes = "my-app/src/routes/(top-bar)";

describe("Svelte application generator", () => {
  it("makes the theme selector a form that works without JavaScript", async () => {
    const tree = await produce();
    const selector = tree.get(
      "my-app/src/lib/ThemeSelector/ThemeSelector.svelte",
    );
    expect(selector).toContain('method="post" action="/preferences"');
    expect(selector).toContain('name="theme"');
    expect(selector).toContain(
      '<noscript><Button importance="secondary" type="submit">Apply</Button></noscript>',
    );
    const preferences = tree.get("my-app/src/routes/preferences/+server.ts");
    expect(preferences).toContain("httpOnly: false");
    expect(preferences).toContain("redirect(303");
  });

  it("makes the language selector a form with --intl", async () => {
    const tree = await produce({ intl: true });
    expect(
      tree.get("my-app/src/lib/LocaleSelector/LocaleSelector.svelte"),
    ).toContain('method="post" action="/language"');
    expect(tree.get("my-app/src/routes/language/+server.ts")).toContain(
      "httpOnly: false",
    );
    expect(tree.get("my-app/src/i18n/en.ts")).toContain(
      '"preferences.apply": "Apply"',
    );
  });

  it("names the application in the top bar and the document title", async () => {
    const tree = await produce();
    expect(tree.get("my-app/src/lib/TopBar/TopBar.svelte")).toContain(
      'href="/">my-app</a>',
    );
    expect(tree.get("my-app/src/formatDocumentTitle.ts")).toContain(
      "— my-app`",
    );
  });

  it("uses native controls and no form package with --no-forms", async () => {
    const tree = await produce({ forms: false });
    for (const [file, content] of tree) {
      expect(content, file).not.toContain("svelte-ds-global-form");
    }
    expect(
      tree.get("my-app/src/lib/ThemeSelector/ThemeSelector.svelte"),
    ).toContain('<select aria-label="Color theme" name="theme"');
  });

  it("reads the theme from the cookie in the client-only build", async () => {
    const tree = await produce({ rendering: "spa" });
    expect(tree.get("my-app/src/routes/+layout.ts")).toContain(
      "readTheme(document.cookie)",
    );
    expect(tree.get("my-app/src/routes/+layout.svelte")).toContain(
      "setTheme(data.theme)",
    );
  });

  it("offers form components by default", () => {
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

  it("scaffolds every file present in the templates directory", async () => {
    const templatesDir = fileURLToPath(new URL("./templates", import.meta.url));
    const expected = readdirSync(templatesDir, { recursive: true })
      .map((entry) => String(entry).split(path.sep).join("/"))
      .filter((rel) => statSync(path.join(templatesDir, rel)).isFile())
      .map((rel) => rel.replace(/\.ejs$/, ""))
      .map((rel) => (rel === "gitignore" ? ".gitignore" : rel));
    const written = new Set<string>();
    for (const rendering of ["ssr", "spa"] as const) {
      for (const forms of [false, true]) {
        for (const appShell of [false, true]) {
          for (const intl of [false, true]) {
            const tree = await produce({ rendering, forms, appShell, intl });
            for (const file of tree.keys()) {
              written.add(file.replace(/^my-app\//, ""));
            }
          }
        }
      }
    }
    expect(expected.filter((file) => !written.has(file))).toEqual([]);
  });

  for (const rendering of ["ssr", "spa"] as const) {
    for (const forms of [false, true]) {
      for (const appShell of [false, true]) {
        for (const intl of [false, true]) {
          it(`${rendering}, forms=${forms}, shell=${appShell}, intl=${intl}`, async () => {
            const tree = await produce({ rendering, forms, appShell, intl });
            const files = [...tree.keys()];
            const sources = Object.fromEntries(
              // The app's own biome.json extends a package the scratch
              // directory cannot resolve; every other source is checked.
              [...tree].filter(
                ([file]) =>
                  /\.(ts|js|json)$/.test(file) && !file.endsWith("biome.json"),
              ),
            );
            expect(formatWithBiome(sources).failures).toBeNull();
            for (const [file, content] of tree) {
              expect(content, file).not.toMatch(/<%|%>/);
            }
            const has = (file: string) => tree.has(`my-app/${file}`);
            const ssr = rendering === "ssr";
            const manifest = JSON.parse(tree.get("my-app/package.json") ?? "");
            expect(tree.has(`${routes}/(public)/+page.svelte`)).toBe(true);
            expect(tree.has(`${routes}/(public)/catalog/+page.svelte`)).toBe(
              true,
            );
            expect(tree.has(`${routes}/(public)/account/+page.svelte`)).toBe(
              true,
            );
            expect(tree.has(`${routes}/(public)/contact/+page.svelte`)).toBe(
              forms,
            );
            expect(tree.has(`${routes}/(public)/contact/+page.server.ts`)).toBe(
              forms && ssr,
            );
            expect(tree.has(`${routes}/dashboard/+page.svelte`)).toBe(appShell);
            expect(
              tree.has(`${routes}/dashboard/instances/+page.server.ts`),
            ).toBe(appShell && forms && ssr);
            expect(
              has("src/lib/ApplicationShell/ApplicationShell.svelte"),
            ).toBe(appShell);
            expect(has("src/lib/LocaleSelector/LocaleSelector.svelte")).toBe(
              intl,
            );
            expect(has("src/i18n/en.ts")).toBe(intl);
            expect(has("src/hooks.server.ts")).toBe(ssr);
            expect(has("src/routes/preferences/+server.ts")).toBe(ssr);
            expect(has("src/routes/language/+server.ts")).toBe(intl && ssr);
            expect(has("src/routes/sitemap.xml/+server.ts")).toBe(ssr);
            expect(has("src/routes/+layout.ts")).toBe(!ssr);
            expect(has("test/app.test.js")).toBe(ssr);
            expect(has("test/spa.test.js")).toBe(!ssr);
            expect(files.some((file) => file.endsWith(".tsx"))).toBe(false);
            expect(files.some((file) => /graphql|relay/i.test(file))).toBe(
              false,
            );
            expect(
              manifest.dependencies["@canonical/svelte-ds-app"] !== undefined,
            ).toBe(appShell);
            expect(
              manifest.dependencies["@canonical/svelte-ds-global-form"] !==
                undefined,
            ).toBe(forms);
            expect(JSON.stringify(manifest)).not.toMatch(
              /react|relay|graphql|workspace:/i,
            );
          });
        }
      }
    }
  }
});

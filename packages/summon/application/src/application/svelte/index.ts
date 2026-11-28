import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorDefinition,
  PromptDefinition,
} from "@canonical/summon-core";
import {
  type LoadedTemplate,
  loadTemplateSync,
  rawFile,
  template,
  withHelpers,
} from "@canonical/summon-core";
import {
  exec,
  exists,
  fail,
  flatMap,
  info,
  sequence_,
  when,
} from "@canonical/task";
import { pickPackageManager } from "../../shared/packageManager.js";
import { packageVersion } from "../../shared/packageVersion.js";
import { validateAppPath } from "../../shared/validators.js";
import { resolvePragmaVersion } from "../../shared/versions.js";
import { textHelpers } from "./textHelpers.js";

export interface ApplicationSvelteAnswers {
  readonly appPath: string;
  readonly forms: boolean;
  readonly appShell: boolean;
  readonly intl: boolean;
  readonly rendering: "ssr" | "spa";
  readonly runInstall: boolean;
}

const prompts: PromptDefinition[] = [
  {
    name: "appPath",
    type: "text",
    message: "Application directory name:",
    default: "my-app",
    positional: true,
    validate: validateAppPath,
    group: "Application",
  },
  {
    name: "forms",
    type: "confirm",
    message: "Include form components?",
    default: true,
    group: "Application",
  },
  {
    name: "appShell",
    type: "confirm",
    message: "Include the application shell and its dashboard?",
    default: true,
    group: "Application",
  },
  {
    name: "intl",
    type: "confirm",
    message:
      "Include internationalisation (locale negotiation, translated UI, locale switcher)?",
    default: false,
    group: "Application",
  },
  {
    name: "rendering",
    type: "select",
    message: "Rendering — ssr uses adapter-node, spa is client-only",
    choices: [
      { label: "ssr - server-side rendering (adapter-node)", value: "ssr" },
      {
        label: "spa - client-only single-page app (static fallback)",
        value: "spa",
      },
    ],
    default: "ssr",
    group: "Application",
  },
  {
    name: "runInstall",
    type: "confirm",
    message: "Install dependencies now?",
    default: true,
    group: "Application",
  },
];

const templatesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
);

/** The flags a template file depends on. */
interface Flags {
  readonly forms: boolean;
  readonly appShell: boolean;
  readonly intl: boolean;
  readonly spa: boolean;
}

/**
 * Every template the generator can write, with the answers that include it.
 * A `.ejs` file renders with the answers; any other file is copied as is.
 */
const files: readonly (readonly [string, (flags: Flags) => boolean])[] = [
  ...[
    "package.json.ejs",
    "README.md.ejs",
    "biome.json.ejs",
    "gitignore.ejs",
    "svelte.config.js.ejs",
    "tsconfig.json",
    "vite.config.ts",
    "vitest.config.ts",
    ".storybook/main.ts",
    ".storybook/preview.ts.ejs",
    "src/app.html.ejs",
    "src/formatDocumentTitle.ts.ejs",
    "src/params/guide.ts",
    "src/layouts/ErrorPage.svelte.ejs",
    "src/layouts/PublicLayout.svelte",
    "src/layouts/RootLayout.svelte.ejs",
    "src/layouts/TopBarLayout.svelte",
    "src/lib/index.ts.ejs",
    "src/lib/CodeMessage/CodeMessage.svelte",
    "src/lib/CodeMessage/index.ts",
    "src/lib/CodeMessage/types.ts",
    "src/lib/ExampleComponent/ExampleComponent.stories.svelte",
    "src/lib/ExampleComponent/ExampleComponent.svelte",
    "src/lib/ExampleComponent/index.ts",
    "src/lib/ExampleComponent/styles.css",
    "src/lib/ExampleComponent/types.ts",
    "src/lib/LazyComponent/LazyComponent.stories.svelte",
    "src/lib/LazyComponent/LazyComponent.svelte.ejs",
    "src/lib/LazyComponent/createDelayedData.ts.ejs",
    "src/lib/LazyComponent/index.ts",
    "src/lib/LazyComponent/types.ts.ejs",
    "src/lib/Navigation/Navigation.svelte.ejs",
    "src/lib/Navigation/index.ts",
    "src/lib/Navigation/types.ts",
    "src/lib/ThemeSelector/ThemeSelector.svelte.ejs",
    "src/lib/ThemeSelector/constants.ts",
    "src/lib/ThemeSelector/index.ts",
    "src/lib/ThemeSelector/readTheme.test.ts",
    "src/lib/ThemeSelector/readTheme.ts",
    "src/lib/ThemeSelector/setTheme.ts",
    "src/lib/ThemeSelector/types.ts",
    "src/lib/TopBar/TopBar.stories.svelte.ejs",
    "src/lib/TopBar/TopBar.svelte.ejs",
    "src/lib/TopBar/index.ts",
    "src/lib/TopBar/styles.css",
    "src/lib/TopBar/types.ts",
    "src/domains/account/AccountPage.svelte.ejs",
    "src/domains/account/LoginPage.svelte.ejs",
    "src/domains/account/getAuthRedirect.test.ts",
    "src/domains/account/getAuthRedirect.ts",
    "src/domains/account/guardAccount.ts",
    "src/domains/catalog/CatalogPage.svelte.ejs",
    "src/domains/catalog/ProductCard.svelte.ejs",
    "src/domains/catalog/ProductList.stories.svelte.ejs",
    "src/domains/catalog/ProductList.svelte.ejs",
    "src/domains/catalog/constants.ts",
    "src/domains/catalog/data.test.ts",
    "src/domains/catalog/data.ts",
    "src/domains/catalog/loadCatalog.ts",
    "src/domains/catalog/types.ts",
    "src/domains/marketing/GuidePage.svelte.ejs",
    "src/domains/marketing/HomePage.svelte.ejs",
    "src/domains/marketing/isGuideSlug.ts",
    "src/styles/app.css",
    "src/styles/index.css.ejs",
    "src/styles/standins.css.ejs",
    "src/styles/standins/InlineCode.css",
    "src/routes/+error.svelte",
    "src/routes/+layout.svelte.ejs",
    "src/routes/(top-bar)/+layout.svelte",
    "src/routes/(top-bar)/(public)/+layout.svelte",
    "src/routes/(top-bar)/(public)/+page.svelte",
    "src/routes/(top-bar)/(public)/account/+page.svelte",
    "src/routes/(top-bar)/(public)/account/+page.ts",
    "src/routes/(top-bar)/(public)/catalog/+page.svelte",
    "src/routes/(top-bar)/(public)/catalog/+page.ts",
    "src/routes/(top-bar)/(public)/guides/[slug=guide]/+page.svelte",
    "src/routes/(top-bar)/(public)/login/+page.svelte",
  ].map((file) => [file, () => true] as const),
  // The server: its hooks, the form targets, the icons and the sitemap.
  ...[
    "src/app.d.ts.ejs",
    "src/hooks.server.ts.ejs",
    "src/resolveReturnTo.test.ts",
    "src/resolveReturnTo.ts",
    "src/routes/+layout.server.ts.ejs",
    "src/routes/(top-bar)/(public)/+page.server.ts",
    "src/routes/home/+server.ts",
    "src/routes/icons/[icon]/+server.ts",
    "src/routes/preferences/+server.ts",
    "src/routes/sitemap.xml/+server.ts.ejs",
    "test/app.test.js.ejs",
  ].map((file) => [file, ({ spa }: Flags) => !spa] as const),
  // The client-only build: browser loads, and the icons as static files.
  ...[
    "scripts/copy-icons.js",
    "src/routes/+layout.ts.ejs",
    "src/routes/(top-bar)/(public)/+page.ts",
    "src/routes/home/+page.ts",
    "test/spa.test.js.ejs",
  ].map((file) => [file, ({ spa }: Flags) => spa] as const),
  ...[
    "src/i18n/ar.ts.ejs",
    "src/i18n/catalogs.ts",
    "src/i18n/config.ts",
    "src/i18n/en.ts.ejs",
    "src/i18n/fr.ts.ejs",
    "src/i18n/index.ts",
    "src/i18n/negotiation.test.ts",
    "src/lib/LocaleSelector/LocaleSelector.svelte.ejs",
    "src/lib/LocaleSelector/index.ts",
    "src/lib/LocaleSelector/types.ts",
    "src/storybook/I18nDecorator.svelte",
    "src/storybook/decorators.ts",
  ].map((file) => [file, ({ intl }: Flags) => intl] as const),
  [
    "src/routes/language/+server.ts",
    ({ intl, spa }: Flags) => intl && !spa,
  ] as const,
  ...[
    "src/domains/contact/ContactPage.svelte.ejs",
    "src/domains/contact/types.ts.ejs",
    "src/domains/contact/validateContact.test.ts.ejs",
    "src/domains/contact/validateContact.ts.ejs",
    "src/routes/(top-bar)/(public)/contact/+page.svelte.ejs",
  ].map((file) => [file, ({ forms }: Flags) => forms] as const),
  [
    "src/routes/(top-bar)/(public)/contact/+page.server.ts",
    ({ forms, spa }: Flags) => forms && !spa,
  ] as const,
  // The application shell and its dashboard.
  ...[
    "src/lib/ApplicationShell/ApplicationShell.stories.svelte",
    "src/lib/ApplicationShell/ApplicationShell.svelte.ejs",
    "src/lib/ApplicationShell/index.ts",
    "src/lib/ApplicationShell/styles.css",
    "src/lib/ApplicationShell/types.ts",
    "src/lib/CanonicalLogo/CanonicalLogo.svelte.ejs",
    "src/lib/CanonicalLogo/index.ts",
    "src/lib/CanonicalLogo/styles.css",
    "src/lib/CanonicalLogo/types.ts",
    "src/lib/Icon/Icon.svelte",
    "src/lib/Icon/index.ts",
    "src/lib/Icon/types.ts",
    "src/domains/dashboard/DashboardBreadcrumbs.svelte.ejs",
    "src/domains/dashboard/DashboardLayout.svelte.ejs",
    "src/domains/dashboard/InstancesPage.svelte.ejs",
    "src/domains/dashboard/OverviewPage.svelte.ejs",
    "src/domains/dashboard/SettingsPage.svelte.ejs",
    "src/domains/dashboard/constants.ts.ejs",
    "src/domains/dashboard/createDashboardNavigation.ts.ejs",
    "src/domains/dashboard/projectBreadcrumbs.test.ts",
    "src/domains/dashboard/projectBreadcrumbs.ts",
    "src/domains/dashboard/selectRelativeTime.test.ts",
    "src/domains/dashboard/selectRelativeTime.ts",
    "src/domains/dashboard/styles.css",
    "src/domains/dashboard/types.ts.ejs",
    "src/styles/standins/Card.css",
    "src/styles/standins/Icon.css",
    "src/styles/standins/Tile.css",
    "src/styles/standins/Timeline.css",
    "src/routes/(top-bar)/dashboard/+layout.svelte",
    "src/routes/(top-bar)/dashboard/+page.svelte",
    "src/routes/(top-bar)/dashboard/instances/+page.svelte.ejs",
    "src/routes/(top-bar)/dashboard/settings/+page.svelte",
  ].map((file) => [file, ({ appShell }: Flags) => appShell] as const),
  ...[
    "src/domains/dashboard/createInstance.test.ts",
    "src/domains/dashboard/createInstance.ts",
    "src/styles/standins/SidePanel.css",
  ].map(
    (file) =>
      [file, ({ appShell, forms }: Flags) => appShell && forms] as const,
  ),
  ...[
    "src/routes/(top-bar)/dashboard/instances/+page.server.ts.ejs",
    "src/routes/(top-bar)/dashboard/settings/+page.server.ts",
  ].map(
    (file) =>
      [
        file,
        ({ appShell, forms, spa }: Flags) => appShell && forms && !spa,
      ] as const,
  ),
];

/** Where a template lands: its path without `.ejs`, and `gitignore` dotted. */
function destinationOf(file: string): string {
  const dest = file.replace(/\.ejs$/, "");
  return dest === "gitignore" ? ".gitignore" : dest;
}

/**
 * Carried files, read on first `generate()` and cached by path, never at
 * module evaluation.
 */
const templateCache = new Map<string, LoadedTemplate>();
function load(source: string): LoadedTemplate {
  let loaded = templateCache.get(source);
  if (!loaded) {
    loaded = loadTemplateSync(source);
    templateCache.set(source, loaded);
  }
  return loaded;
}

export const generator: GeneratorDefinition<ApplicationSvelteAnswers> = {
  meta: {
    name: "application/svelte",
    displayName: "@canonical/summon-application:application/svelte",
    description:
      "Scaffold a SvelteKit application with server rendering or a client-only SPA",
    version: packageVersion(),
    help: "Creates a SvelteKit application using Canonical styles, the counterpart of application/react: the same pages, components, messages and behaviours. GraphQL and Relay are not included. The SPA requires a static host fallback to 200.html.",
    examples: [
      "summon application/svelte my-app",
      "summon application/svelte my-app --rendering spa",
      "summon application/svelte my-app --intl",
    ],
  },
  prompts,
  generate: (answers) => {
    const appPath =
      (answers.appPath || "my-app").trim().replace(/\/+$/, "") || "my-app";
    const name = path
      .basename(path.resolve(appPath))
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "");
    if (!name)
      return fail({
        code: "APP_NAME_INVALID",
        message: `Could not derive a valid application name from path "${appPath}".`,
      });
    const flags: Flags = {
      forms: answers.forms,
      appShell: answers.appShell,
      intl: answers.intl,
      spa: answers.rendering === "spa",
    };
    return flatMap(exists(appPath), (present) => {
      if (present)
        return fail({
          code: "APP_DEST_EXISTS",
          message: `"${appPath}" already exists. Choose a different directory or remove it first.`,
        });
      return flatMap(resolvePragmaVersion(), (ranges) => {
        const vars = withHelpers({
          name,
          ...flags,
          pragmaVersion: ranges.core,
          pragmaWebVersion: ranges.web,
          ...textHelpers(flags.intl),
        });
        const write = (file: string) => {
          const source = path.join(templatesDir, file);
          const dest = path.join(appPath, destinationOf(file));
          return file.endsWith(".ejs")
            ? template({ source, dest, vars })
            : rawFile({ source, content: load(source).content, dest });
        };
        const pm = pickPackageManager();
        return sequence_([
          info(`Scaffolding SvelteKit application in "${appPath}"...`),
          ...files
            .filter(([, included]) => included(flags))
            .map(([file]) => write(file)),
          when(
            answers.runInstall && pm !== null,
            sequence_([
              info(`Installing dependencies with ${pm}...`),
              exec(pm ?? "bun", ["install"], appPath),
            ]),
          ),
          info(
            `Application "${appPath}" created. ${answers.runInstall && pm ? "" : "Install dependencies, then "}run the dev script in that directory.`,
          ),
        ]);
      });
    });
  },
};

export default generator;

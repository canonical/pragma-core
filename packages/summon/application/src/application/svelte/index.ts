import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorDefinition,
  PromptDefinition,
} from "@canonical/summon-core";
import { template, withHelpers } from "@canonical/summon-core";
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
    message: "Include a native contact form demonstration?",
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

export const generator: GeneratorDefinition<ApplicationSvelteAnswers> = {
  meta: {
    name: "application/svelte",
    displayName: "@canonical/summon-application:application/svelte",
    description:
      "Scaffold a SvelteKit application with server rendering or a client-only SPA",
    version: packageVersion(),
    help: "Creates a SvelteKit application using Canonical styles. Forms default to native demonstrations; no message is delivered. GraphQL and Relay are not included. The SPA requires a static host fallback to 200.html.",
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
    return flatMap(exists(appPath), (present) => {
      if (present)
        return fail({
          code: "APP_DEST_EXISTS",
          message: `"${appPath}" already exists. Choose a different directory or remove it first.`,
        });
      return flatMap(resolvePragmaVersion(), (ranges) => {
        const vars = withHelpers({
          name,
          forms: answers.forms,
          appShell: answers.appShell,
          intl: answers.intl,
          spa: answers.rendering === "spa",
          pragmaWebVersion: ranges.web,
        });
        const writeTemplate = (
          source: string,
          dest = source.replace(/\.ejs$/, ""),
        ) =>
          template({
            source: path.join(templatesDir, source),
            dest: path.join(appPath, dest),
            vars,
          });
        const pm = pickPackageManager();
        return sequence_([
          info(`Scaffolding SvelteKit application in "${appPath}"...`),
          ...[
            "package.json.ejs",
            "README.md.ejs",
            "svelte.config.js.ejs",
            "vite.config.ts.ejs",
            "tsconfig.json.ejs",
            "src/app.html.ejs",
            "src/routes/+layout.svelte.ejs",
            "src/routes/+page.svelte.ejs",
            "src/routes/+error.svelte.ejs",
            "src/routes/catalog/+page.svelte.ejs",
            "src/routes/catalog/[id]/+page.svelte.ejs",
            "src/lib/catalog.ts.ejs",
            "src/styles.css.ejs",
            "test/app.test.js.ejs",
          ].map((name) => writeTemplate(name)),
          writeTemplate("gitignore.ejs", ".gitignore"),
          writeTemplate("scripts/copy-icons.js.ejs"),
          ...[
            ".storybook/main.ts.ejs",
            ".storybook/preview.ts.ejs",
            "src/lib/Welcome.stories.svelte.ejs",
          ].map((name) => writeTemplate(name)),
          when(
            answers.forms,
            writeTemplate("src/lib/ContactExample.svelte.ejs"),
          ),
          when(
            answers.forms,
            writeTemplate("src/lib/ContactExample.stories.svelte.ejs"),
          ),
          when(
            answers.rendering === "spa",
            writeTemplate("src/routes/catalog/[id]/+page.ts.ejs"),
          ),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/routes/catalog/[id]/+page.server.ts.ejs"),
          ),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/hooks.server.ts.ejs"),
          ),
          when(answers.rendering !== "spa", writeTemplate("src/app.d.ts.ejs")),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/routes/+layout.server.ts.ejs"),
          ),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/routes/preferences/+server.ts.ejs"),
          ),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/lib/resolveReturnTo.ts.ejs"),
          ),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/routes/sitemap.xml/+server.ts.ejs"),
          ),
          when(
            answers.rendering !== "spa",
            writeTemplate("src/routes/home/+server.ts.ejs"),
          ),
          when(
            answers.rendering === "spa",
            writeTemplate("src/routes/+layout.ts.ejs"),
          ),
          when(answers.forms, writeTemplate("src/lib/contact.ts.ejs")),
          when(
            answers.forms,
            writeTemplate("test/contact.browser.test.js.ejs"),
          ),
          when(
            answers.appShell && answers.forms,
            writeTemplate("src/lib/settings.ts.ejs"),
          ),
          when(
            answers.forms,
            writeTemplate("src/routes/contact/+page.svelte.ejs"),
          ),
          when(
            answers.forms && answers.rendering !== "spa",
            writeTemplate("src/routes/contact/+page.server.ts.ejs"),
          ),
          ...[
            "src/routes/dashboard/+layout.svelte.ejs",
            "src/routes/dashboard/+page.svelte.ejs",
            "src/routes/dashboard/instances/+page.svelte.ejs",
            "src/routes/dashboard/settings/+page.svelte.ejs",
          ].map((name) => when(answers.appShell, writeTemplate(name))),
          when(
            answers.appShell,
            writeTemplate("src/lib/DashboardNavigation.svelte.ejs"),
          ),
          when(
            answers.appShell,
            writeTemplate("src/lib/ProjectDanger.svelte.ejs"),
          ),
          when(
            answers.appShell,
            writeTemplate(
              "src/routes/dashboard/settings/confirm/+page.svelte.ejs",
            ),
          ),
          when(
            answers.appShell && answers.rendering !== "spa",
            writeTemplate(
              "src/routes/dashboard/settings/confirm/+page.server.ts.ejs",
            ),
          ),
          ...[
            "src/routes/account/+page.svelte.ejs",
            "src/routes/login/+page.svelte.ejs",
          ].map((name) => when(answers.appShell, writeTemplate(name))),
          ...[
            "src/routes/account/+page.server.ts.ejs",
            "src/routes/login/+page.server.ts.ejs",
            "src/routes/dashboard/+page.server.ts.ejs",
          ].map((name) =>
            when(
              answers.appShell && answers.rendering !== "spa",
              writeTemplate(name),
            ),
          ),
          when(
            answers.appShell && answers.forms && answers.rendering !== "spa",
            writeTemplate("src/routes/dashboard/settings/+page.server.ts.ejs"),
          ),
          when(
            answers.appShell && answers.forms,
            writeTemplate("src/lib/instances.ts.ejs"),
          ),
          when(
            answers.appShell && answers.forms && answers.rendering !== "spa",
            writeTemplate("src/routes/dashboard/instances/+page.server.ts.ejs"),
          ),
          ...[
            "src/routes/dashboard/instances/remove/+page.svelte.ejs",
            "src/routes/dashboard/instances/remove/+page.server.ts.ejs",
          ].map((name) =>
            when(
              answers.appShell && answers.forms && answers.rendering !== "spa",
              writeTemplate(name),
            ),
          ),
          when(answers.intl, writeTemplate("src/lib/i18n.ts.ejs")),
          when(
            answers.intl && answers.rendering !== "spa",
            writeTemplate("src/routes/language/+server.ts.ejs"),
          ),
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

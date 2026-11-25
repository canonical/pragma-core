import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERATOR_INVALID_ANSWER,
  type GeneratorDefinition,
  type PromptDefinition,
} from "@canonical/summon-core";
import {
  exists,
  fail,
  flatMap,
  info,
  sequence_,
  writeFile,
} from "@canonical/task";
import { toCamelCase, toPascalCase, toTitleCase } from "@canonical/utils";
import { normalizeCommandPath } from "../shared/casing.js";
import { packageVersion } from "../shared/packageVersion.js";
import { renderTemplate } from "../shared/renderTemplate.js";
import {
  validateCommandPath,
  validateKebabName,
} from "../shared/validators.js";

/** The page generator's own templates, copied next to it by the build. */
const templatesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "templates",
);

export interface PageAnswers {
  readonly pagePath: string;
  readonly framework?: "react" | "svelte";
}

const validateSegments = validateCommandPath({
  label: "Page path",
  minSegments: 2,
  maxSegments: 2,
  example: "invoices/detail",
});

/**
 * Words JavaScript reserves, which the printed wiring cannot use as the route
 * key it destructures (`const [new] = group(…)` does not parse).
 */
const RESERVED = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/**
 * Two name segments, `<domain>/<name>`. A leading slash is refused rather than
 * stripped: "/invoices/detail" reads as a url or an absolute path, and the
 * page path is neither.
 */
function validatePagePath(value: unknown): true | string {
  if (typeof value === "string" && /^\s*[/\\]/.test(value)) {
    return "Page path must be <domain>/<name>, not an absolute path (for example invoices/detail)";
  }
  const verdict = validateSegments(value);
  if (verdict !== true) return verdict;
  const name = normalizeCommandPath(String(value)).split("/")[1] as string;
  // The file, component and route key are named from it (`order-lines` →
  // `OrderLinesPage`, `orderLines`), so it must be kebab-case.
  const kebab = validateKebabName({
    label: "Page name",
    example: "order-lines",
  })(name);
  if (kebab !== true) return kebab;
  const key = toCamelCase(name);
  if (RESERVED.has(key)) {
    return `Page name "${name}" would make the route key "${key}", a word JavaScript reserves; choose another name (for example ${name}-page)`;
  }
  return true;
}

const prompts: PromptDefinition[] = [
  {
    name: "pagePath",
    type: "text",
    message: "Page path, as <domain>/<name> (for example invoices/detail):",
    positional: true,
    validate: validatePagePath,
    group: "Page",
  },
  {
    name: "framework",
    type: "select",
    message: "Application framework:",
    choices: [
      { label: "React", value: "react" },
      { label: "SvelteKit", value: "svelte" },
    ],
    default: "react",
    group: "Page",
  },
];

export const generator: GeneratorDefinition<PageAnswers> = {
  meta: {
    name: "page",
    displayName: "@canonical/summon-application:page",
    description: "Add a page component to an existing domain",
    version: packageVersion(),
    help: `For React, writes src/domains/<domain>/<Name>Page.tsx and prints routing guidance.
With --framework svelte, writes src/routes/<domain>/<name>/+page.svelte.

The argument is exactly two segments: the domain, then the page name.
"invoices/detail" writes src/domains/invoices/DetailPage.tsx.

The page is not routed yet. After writing it, the generator prints what to add
by hand: the import line for src/domains/<domain>/routes.ts, example route
entries to adapt (a static url, and a url with a :param with the page's params
signature), and the group() and appRoutes lines for src/routes.tsx.

Requires the domain to exist and refuses an existing page file.
--undo deletes the page file.`,
    examples: [
      "summon page invoices/detail",
      "summon page account/settings",
      "summon page --dry-run billing/payments",
      "summon page --undo invoices/detail",
    ],
  },

  prompts,

  generate: (answers) => {
    const verdict = validatePagePath(answers.pagePath);
    if (verdict !== true) {
      return fail({ code: GENERATOR_INVALID_ANSWER, message: verdict });
    }

    const [domainName, name] = normalizeCommandPath(answers.pagePath).split(
      "/",
    );
    const pageName = `${toPascalCase(name)}Page`;
    const domainDir = path.join("src", "domains", domainName);
    const pageFile = path.join(domainDir, `${pageName}.tsx`);
    const routesFile = path.join(domainDir, "routes.ts");
    const svelteDomain = path.join("src", "routes", domainName);
    const svelteRoute = path.join(svelteDomain, name, "+page.svelte");

    // No mkdir: the page goes into an *existing* domain (guarded below), and
    // mkdir's default undo would delete that domain's folder on `--undo`.
    // writeFile's default undo deletes the file, which is exactly `--undo`.
    const vars = {
      domain: domainName,
      name,
      pageName,
      title: toTitleCase(name),
      key: toCamelCase(name),
      domainRoutes: `${toCamelCase(domainName)}Routes`,
    };
    const scaffold = sequence_([
      writeFile(pageFile, renderTemplate(templatesDir, "Page.tsx.ejs", vars)),
      // One message, so the code lines print without a per-line prefix and
      // can be copied as they are.
      info(
        renderTemplate(templatesDir, "routingGuide.txt.ejs", vars).trimEnd(),
      ),
    ]);

    // Guard before touching anything. Both refusals are the answer's fault
    // (a domain that is not there, a name already taken), so they carry the
    // invalid-answer code hosts report as a usage error, not as a bug:
    // - the domain must exist (a page is added to an existing domain);
    // - the page must NOT exist (the write's undo is a delete, so overwriting
    //   a hand-authored page then running `--undo` would destroy the original).
    if (answers.framework === "svelte") {
      return flatMap(
        exists(path.join(svelteDomain, "+page.svelte")),
        (domainPresent) =>
          !domainPresent
            ? fail({
                code: GENERATOR_INVALID_ANSWER,
                message: `SvelteKit domain "${domainName}" not found. Create it first.`,
              })
            : flatMap(exists(svelteRoute), (present) =>
                present
                  ? fail({
                      code: GENERATOR_INVALID_ANSWER,
                      message: `Page "${svelteRoute}" already exists.`,
                    })
                  : sequence_([
                      writeFile(
                        svelteRoute,
                        renderTemplate(templatesDir, "Page.svelte.ejs", {
                          title: toTitleCase(name),
                        }),
                      ),
                      info(`SvelteKit page created at /${domainName}/${name}.`),
                    ]),
              ),
      );
    }
    return flatMap(exists("svelte.config.js"), (svelte) =>
      svelte
        ? fail({
            code: GENERATOR_INVALID_ANSWER,
            message:
              "This is a SvelteKit application; run again with --framework svelte.",
          })
        : flatMap(exists(routesFile), (domainPresent) =>
            !domainPresent
              ? fail({
                  code: GENERATOR_INVALID_ANSWER,
                  message: `Domain "${domainName}" not found: ${routesFile} is missing. Create the domain first.`,
                })
              : flatMap(exists(pageFile), (pagePresent) =>
                  pagePresent
                    ? fail({
                        code: GENERATOR_INVALID_ANSWER,
                        message: `Page "${pageFile}" already exists. Choose a different page name or remove the file first.`,
                      })
                    : scaffold,
                ),
          ),
    );
  },
};

export default generator;

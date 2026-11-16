/**
 * Playground Generator
 *
 * Generates a standalone Storybook project for prototyping components with the
 * pragma design system: the design system's styles, Storybook configuration
 * and chosen component packages installed, and one sample component whose
 * stories show each package in use.
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  componentLayerFor,
  type GeneratorDefinition,
  loadTemplateSync,
  type PromptDefinition,
  template,
} from "@canonical/summon-core";
import {
  attempt,
  deleteDirectory,
  exec,
  exists,
  fail,
  flatMap,
  info,
  mkdir,
  sequence_,
  type Task,
  warn,
  when,
} from "@canonical/task";

import {
  detectPackageManager,
  PACKAGE_NAME,
  type PlaygroundAnswers,
  type PlaygroundFramework,
  type PlaygroundPackage,
  PRAGMA_WEB_VERSION,
  packageVersion,
  validatePlaygroundPath,
} from "../shared/index.js";

// =============================================================================
// Templates
// =============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "..", "templates", "playground");

const load = (...segments: string[]) =>
  loadTemplateSync(path.join(templatesDir, ...segments));

/** Templates both frameworks share. */
function loadSharedTemplates() {
  return {
    biome: load("shared", "biome.json.ejs"),
    gitignore: load("shared", "gitignore.ejs"),
    readme: load("shared", "README.md.ejs"),
    storybookMain: load("shared", "storybook-main.ts.ejs"),
    storybookPreview: load("shared", "storybook-preview.ts.ejs"),
    storybookStyles: load("shared", "storybook-styles.css.ejs"),
    styles: load("shared", "styles.css.ejs"),
  };
}

function loadReactTemplates() {
  return {
    packageJson: load("react", "package.json.ejs"),
    tsconfig: load("react", "tsconfig.json.ejs"),
    index: load("react", "index.ts.ejs"),
    types: load("react", "types.ts.ejs"),
    component: load("react", "Prototype.tsx.ejs"),
    stories: load("react", "Prototype.stories.tsx.ejs"),
  };
}

function loadSvelteTemplates() {
  return {
    packageJson: load("svelte", "package.json.ejs"),
    tsconfig: load("svelte", "tsconfig.json.ejs"),
    svelteConfig: load("svelte", "svelte.config.js.ejs"),
    viteConfig: load("svelte", "vite.config.ts.ejs"),
    index: load("svelte", "index.ts.ejs"),
    types: load("svelte", "types.ts.ejs"),
    component: load("svelte", "Prototype.svelte.ejs"),
    stories: load("svelte", "Prototype.stories.svelte.ejs"),
  };
}

/**
 * Template bundles are loaded on the first `generate()` that needs them, never
 * at module evaluation, so importing the generator reads no template and a
 * React run never opens a Svelte one.
 */
const memoize = <T>(loader: () => T): (() => T) => {
  let cache: T | undefined;
  return () => {
    cache ??= loader();
    return cache;
  };
};

const sharedTemplates = memoize(loadSharedTemplates);
const reactTemplates = memoize(loadReactTemplates);
const svelteTemplates = memoize(loadSvelteTemplates);

/** What the templates read. */
interface PlaygroundContext {
  name: string;
  framework: PlaygroundFramework;
  dsGlobal: boolean;
  dsGlobalForm: boolean;
  dsApp: boolean;
  componentLayer: string;
  coreVersion: string;
  webVersion: string;
  [key: string]: unknown;
}

// =============================================================================
// Prompts
// =============================================================================

const prompts: PromptDefinition[] = [
  {
    name: "playgroundPath",
    type: "text",
    message: "Playground directory:",
    default: "playground",
    positional: true,
    validate: validatePlaygroundPath,
    group: "Playground",
  },
  {
    name: "framework",
    type: "select",
    message: "Framework:",
    choices: [
      { label: "react - React and @storybook/react-vite", value: "react" },
      {
        label: "svelte - Svelte 5 and @storybook/svelte-vite",
        value: "svelte",
      },
    ],
    default: "react",
    group: "Playground",
  },
  {
    name: "packages",
    type: "multiselect",
    message: "Packages (styles always included):",
    choices: [
      { label: "ds-global - the global components", value: "ds-global" },
      {
        label: "ds-global-form - form fields and their stylesheet (React only)",
        value: "ds-global-form",
      },
      { label: "ds-app - the application components", value: "ds-app" },
    ],
    default: ["ds-global", "ds-global-form"],
    group: "Design system",
  },
  {
    name: "gitInit",
    type: "confirm",
    message: "Initialise a git repository?",
    default: true,
    group: "Post-setup",
  },
  {
    name: "runInstall",
    type: "confirm",
    message: "Run package manager install after creation?",
    default: true,
    group: "Post-setup",
  },
];

// =============================================================================
// Generation
// =============================================================================

/** The package name: the directory's last segment, lowercased. */
const playgroundName = (playgroundPath: string): string =>
  path.basename(playgroundPath).toLowerCase();

/** Render one template to a path inside the playground. */
const writeTemplate = (
  loaded: { source: string; content: string },
  ctx: PlaygroundContext,
  ...dest: string[]
): Task<void> =>
  template({
    source: loaded.source,
    content: loaded.content,
    dest: path.join(...dest),
    vars: ctx,
  });

function generateFiles(ctx: PlaygroundContext, dir: string): Task<void> {
  const shared = sharedTemplates();
  const storybook = path.join(dir, ".storybook");
  const prototype = path.join(dir, "src", "Prototype");

  const frameworkFiles = (): Task<void>[] => {
    if (ctx.framework === "svelte") {
      const t = svelteTemplates();
      return [
        writeTemplate(t.packageJson, ctx, dir, "package.json"),
        writeTemplate(t.tsconfig, ctx, dir, "tsconfig.json"),
        writeTemplate(t.svelteConfig, ctx, dir, "svelte.config.js"),
        writeTemplate(t.viteConfig, ctx, dir, "vite.config.ts"),
        writeTemplate(t.index, ctx, prototype, "index.ts"),
        writeTemplate(t.types, ctx, prototype, "types.ts"),
        writeTemplate(t.component, ctx, prototype, "Prototype.svelte"),
        writeTemplate(t.stories, ctx, prototype, "Prototype.stories.svelte"),
      ];
    }
    const t = reactTemplates();
    return [
      writeTemplate(t.packageJson, ctx, dir, "package.json"),
      writeTemplate(t.tsconfig, ctx, dir, "tsconfig.json"),
      writeTemplate(t.index, ctx, prototype, "index.ts"),
      writeTemplate(t.types, ctx, prototype, "types.ts"),
      writeTemplate(t.component, ctx, prototype, "Prototype.tsx"),
      writeTemplate(t.stories, ctx, prototype, "Prototype.stories.tsx"),
    ];
  };

  return sequence_([
    mkdir(dir),
    mkdir(storybook),
    mkdir(path.join(dir, "src")),
    mkdir(prototype),
    ...frameworkFiles(),
    writeTemplate(shared.biome, ctx, dir, "biome.json"),
    writeTemplate(shared.gitignore, ctx, dir, ".gitignore"),
    writeTemplate(shared.readme, ctx, dir, "README.md"),
    writeTemplate(shared.storybookMain, ctx, storybook, "main.ts"),
    writeTemplate(shared.storybookPreview, ctx, storybook, "preview.ts"),
    writeTemplate(shared.storybookStyles, ctx, storybook, "styles.css"),
    writeTemplate(shared.styles, ctx, prototype, "styles.css"),
  ]);
}

/**
 * Make the playground a git repository, so Storybook can mark the stories that
 * changed. Skipped inside an existing repository, where a nested one would
 * hide the playground from it, and when git is missing or fails: the
 * playground works without it. `--undo` removes the `.git` it created.
 */
function initGitRepository(dir: string): Task<void> {
  const probe = exec("git", ["rev-parse", "--is-inside-work-tree"], dir, {
    undo: null,
  });
  return flatMap(attempt(probe), (inside) => {
    if (!inside.ok) {
      return warn("git is not available: skipping git init.");
    }
    if (inside.value.stdout.trim() === "true") {
      return info("Already inside a git repository: skipping git init.");
    }
    const init = exec("git", ["init", "--quiet"], dir, {
      undo: deleteDirectory(path.join(dir, ".git")),
    });
    return flatMap(attempt(init), (result) =>
      result.ok && result.value.exitCode === 0
        ? info("Initialised a git repository")
        : warn("git init failed: the playground is not a git repository."),
    );
  });
}

// =============================================================================
// Generator Definition
// =============================================================================

export const generator: GeneratorDefinition<PlaygroundAnswers> = {
  meta: {
    name: "playground",
    displayName: PACKAGE_NAME,
    description:
      "Generate a Storybook playground for prototyping components with the pragma design system",
    version: packageVersion(),
    help: `Generate a standalone Storybook project, ready to prototype components in.

The playground has:
  - Storybook configured with @canonical/storybook-config: the design
    system's addons, the light/dark toggle and the icon sprites
  - @canonical/styles loaded once, in the app context at comfortable density
  - The design-system packages you choose, installed
  - src/Prototype: a sample component whose stories use each package
  - Biome and TypeScript configured with the pragma configs

FRAMEWORKS (--framework):
  react     React 19 with @storybook/react-vite (the default)
  svelte    Svelte 5 with @storybook/svelte-vite

DESIGN-SYSTEM PACKAGES (--packages, comma-separated):
  ds-global       The global components (default)
  ds-global-form  The form fields and their stylesheet (default; React only:
                  Svelte has no form package, so it is skipped there)
  ds-app          The application components

  @canonical/styles (tokens, fonts, cascade layers, base styles) is always
  installed and loaded once in .storybook/styles.css.

GIT (--no-git-init to skip):
  The playground is made a git repository, so Storybook can mark the stories
  that changed. Skipped inside an existing repository and when git is
  missing.

Start it with \`bun run storybook\` inside the directory. Add components with
\`pragma create component <framework> src/<Name>\`.`,
    examples: [
      "summon playground",
      "summon playground my-prototype --framework=svelte",
      "summon playground prototypes/navigation --packages=ds-global,ds-global-form,ds-app",
      "summon playground my-prototype --packages=ds-global",
    ],
  },

  prompts,

  generate: (answers) => {
    const playgroundPath = answers.playgroundPath.trim().replace(/\/+$/, "");
    const framework = answers.framework;

    const packages = new Set<PlaygroundPackage>(answers.packages ?? []);
    const name = playgroundName(playgroundPath);
    const ctx: PlaygroundContext = {
      name,
      framework,
      dsGlobal: packages.has("ds-global"),
      // Svelte has no form package. The choice is ignored there rather than
      // refused, because it is in the default selection every front-end
      // fills in.
      dsGlobalForm: framework === "react" && packages.has("ds-global-form"),
      dsApp: packages.has("ds-app"),
      componentLayer: componentLayerFor(name),
      coreVersion: packageVersion(),
      webVersion: PRAGMA_WEB_VERSION,
    };

    return flatMap(exists(playgroundPath), (present) => {
      if (present) {
        return fail({
          code: "PLAYGROUND_DEST_EXISTS",
          message:
            `"${playgroundPath}" already exists. Generating over it would ` +
            "let --undo delete files that were there before. Choose another " +
            "directory or remove it first.",
        });
      }

      const cwd = process.cwd();
      return sequence_([
        info(`Creating ${framework} playground: ${playgroundPath}`),
        when(
          framework === "svelte" && packages.has("ds-global-form"),
          info("Skipping ds-global-form: Svelte has no form package."),
        ),
        generateFiles(ctx, playgroundPath),
        when(answers.gitInit, initGitRepository(playgroundPath)),
        when(
          answers.runInstall,
          flatMap(detectPackageManager(cwd), (pm) =>
            sequence_([
              info(`Running ${pm} install...`),
              flatMap(exec(pm, ["install"], playgroundPath), () =>
                info("Dependencies installed successfully"),
              ),
            ]),
          ),
        ),
        info(""),
        info("Start prototyping:"),
        info(`  cd ${playgroundPath}`),
        when(!answers.runInstall, info("  bun install")),
        info("  bun run storybook"),
        info(""),
      ]);
    });
  },
};

export default generator;

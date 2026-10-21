/**
 * Well-formedness of the RENDERED output, across every flag combination.
 *
 * The conformance fixtures prove the producers agree with each other; they say
 * nothing about whether what they agree on is valid. A syntax error inside an
 * EJS branch renders identically through every producer, so it survives a
 * byte-equality check untouched — and only the combinations someone happens to
 * scaffold by hand would ever catch it.
 *
 * This closes that gap for the class it can close hermetically: every emitted
 * TypeScript file must PARSE, and every emitted JSON file must be JSON. It
 * needs no dependency resolution, so it runs anywhere the package's own tests
 * run, and it covers all 16 combinations rather than the two the fixtures pin.
 *
 * What it deliberately does NOT cover is type errors and build failures: those
 * need the generated app's dependencies resolved, and a scaffolded app pins
 * `@canonical/*` at versions that are not on npm yet, so `bun install` inside
 * one cannot succeed in CI. The reference app (`apps/react/boilerplate-vite`)
 * is the mechanism that covers that class today, for the SSR shape only.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderString, withHelpers } from "@canonical/summon-core";
import { describe, expect, it } from "vitest";
import { formatWithBiome } from "../../testing/formatWithBiome.js";

const templatesDir = fileURLToPath(new URL("./templates", import.meta.url));

/** Every `.ejs` under the templates dir, as paths relative to it. */
const templates = readdirSync(templatesDir, { recursive: true })
  .map((entry) => String(entry).split(path.sep).join("/"))
  .filter((rel) => statSync(path.join(templatesDir, rel)).isFile())
  .filter((rel) => rel.endsWith(".ejs"))
  .sort();

/** The generator's own variable set, minus the parts that do not affect syntax. */
function varsFor(combo: {
  forms: boolean;
  intl: boolean;
  relay: boolean;
  spa: boolean;
}) {
  return withHelpers({
    name: "my-app",
    ...combo,
    // `standalone` gates only the patches block in package.json; both arms are
    // exercised because the combination list below flips it with `relay`.
    standalone: true,
    pragmaVersion: "^0.0.0-test",
  });
}

/** All 16 combinations of the four booleans the templates branch on. */
const combos = [false, true].flatMap((forms) =>
  [false, true].flatMap((intl) =>
    [false, true].flatMap((relay) =>
      [false, true].map((spa) => ({ forms, intl, relay, spa })),
    ),
  ),
);

const label = (c: {
  forms: boolean;
  intl: boolean;
  relay: boolean;
  spa: boolean;
}) =>
  `${c.spa ? "spa" : "ssr"}${c.forms ? " +forms" : ""}${c.intl ? " +intl" : ""}${c.relay ? " +relay" : ""}`;

/** Render the template at `rel` (relative to the templates dir) for `combo`. */
function renderTemplate(rel: string, combo: (typeof combos)[number]): string {
  return renderString(
    readFileSync(path.join(templatesDir, rel), "utf8"),
    varsFor(combo),
  );
}

describe("rendered template output is well-formed in every combination", () => {
  for (const combo of combos) {
    it(`${label(combo)}: every emitted file renders, parses, and is valid`, () => {
      const vars = varsFor(combo);
      const typescript: Record<string, string> = {};

      for (const rel of templates) {
        const source = readFileSync(path.join(templatesDir, rel), "utf8");

        // 1. The template renders at all. An unbalanced tag or an undefined
        //    variable in a branch only this combination reaches throws here.
        let rendered: string;
        try {
          rendered = renderString(source, vars);
        } catch (error) {
          throw new Error(
            `${rel} failed to render for ${label(combo)}: ${(error as Error).message}`,
          );
        }

        const dest = rel.slice(0, -".ejs".length);

        // 2. Emitted TypeScript is collected here and parsed below, the whole
        //    combination in one Biome process.
        if (dest.endsWith(".ts") || dest.endsWith(".tsx")) {
          typescript[dest] = rendered;
        }

        // 3. Emitted JSON is JSON. The templates hand-manage commas around
        //    their gates, which is precisely where a subtractive answer breaks.
        if (dest.endsWith(".json")) {
          expect(
            () => JSON.parse(rendered),
            `${dest} is not valid JSON for ${label(combo)}`,
          ).not.toThrow();
        }
      }

      expect(Object.keys(typescript).length).toBeGreaterThan(0);
      expect(
        formatWithBiome(typescript).failures,
        `emitted TypeScript does not parse for ${label(combo)}`,
      ).toBeNull();
    });
  }
});

/**
 * The root declaration and the import order, asserted on the rendered text.
 *
 * These facts are what makes a scaffolded application render as the design
 * system expects, and every one of them is a line in a template that a later
 * edit can quietly move: the class list on `<html>`, and the position of the
 * stylesheet among the entry's imports. The first decides which density
 * channel every control reads; the second decides whether the layer statement
 * is the first thing in the built stylesheet or the 75th kilobyte of it.
 * Neither shows up as a syntax error, so neither is covered by the parse gate
 * above.
 *
 * The root carries context and density, and the theme where the server
 * resolves one. Nothing on it declares the design system itself: its
 * stylesheet applies to the page as it stands.
 */
describe("the rendered application declares its context and density", () => {
  /** The class list every rendered `<html>` must carry. */
  const ROOT_CLASSES = "app comfortable";

  for (const combo of combos) {
    it(`${label(combo)}: <html> carries \`${ROOT_CLASSES}\` and no \`ds\``, () => {
      const html = renderTemplate("index.html.ejs", combo);
      expect(html).toContain(`<html lang="en" class="${ROOT_CLASSES}">`);

      // The SPA arm has no server entry to render.
      if (combo.spa) return;

      // The opening tag on its own line, which is the shape the formatter
      // gives it — a bare `/<html/` would also match the prose in the comment
      // above it. Each rendered root carries the classes, with the theme
      // appended at runtime.
      const server = renderTemplate("src/server/entry.tsx.ejs", combo);
      const roots = [...server.matchAll(/^\s*<html$/gm)];
      expect(roots.length).toBeGreaterThan(0);
      expect(
        [...server.matchAll(/className=\{\["([^"]*)"/g)].map(
          ([, list]) => list,
        ),
      ).toEqual(roots.map(() => ROOT_CLASSES));
    });

    it(`${label(combo)}: the stylesheet is the first import`, () => {
      // "First import" is what the cascade needs: the design system's layer
      // statement has to reach the page before any component's rules do.
      const firstImport = (source: string) => source.match(/^import .*$/m)?.[0];

      expect(
        firstImport(renderTemplate("src/client/entry.tsx.ejs", combo)),
      ).toBe('import "#styles/index.css";');
      expect(
        firstImport(renderTemplate(".storybook/preview.ts.ejs", combo)),
      ).toBe('import "../src/styles/index.css";');
      if (!combo.spa) {
        expect(
          firstImport(renderTemplate("src/server/entry.tsx.ejs", combo)),
        ).toBe('import "#styles/app.css";');
      }
    });

    it(`${label(combo)}: the stylesheet imports the fonts and the components`, () => {
      const styles = renderTemplate("src/styles/index.css.ejs", combo);
      const imports = [...styles.matchAll(/^@import url\("(.+?)"\);$/gm)].map(
        ([, specifier]) => specifier,
      );

      // Order is the point: the fonts (unlayered `@font-face`), then the layer
      // statement, then every component sheet, then the application's own.
      expect(imports.slice(0, 3)).toEqual([
        "@canonical/styles/fonts",
        "@canonical/styles",
        "@canonical/react-ds-global/index.css",
      ]);
      expect(imports.at(-1)).toBe("./app.css");
    });
  }
});

/**
 * One owner per document, asserted on the rendered text.
 *
 * `@canonical/react-head`'s `<Head>` renders `<title>`, `<meta>` and `<link>`
 * as ordinary elements and lets React 19 hoist them into `<head>`, on the
 * server as much as on the client. React emits every `<title>` it is given and
 * HTML takes the *first* in tree order, so a second owner does not merge with
 * the page's title — it beats it. Two owners could creep in without any syntax
 * error: a `<Head>` added to an entry or a layout, or a `<title>` restored to
 * the HTML shell that the server renderer re-emits ahead of the hoisted tags.
 *
 * So: pages own the title, the `Shell` provider nest owns the template that
 * composes it, the entries own neither, and the HTML shell owns a title only
 * in the client-only arm, where React inserts the page's ahead of it.
 */
describe("the rendered application has one document-title owner", () => {
  /** Occurrences of the `Head` element — `HeadProvider` deliberately excluded. */
  const countHead = (source: string) =>
    [...source.matchAll(/<Head[\s/>]/g)].length;

  const pageTemplates = templates.filter((rel) =>
    /^src\/domains\/.+Page\.tsx\.ejs$/.test(rel),
  );

  it("has page templates to check", () => {
    expect(pageTemplates.length).toBeGreaterThan(0);
  });

  for (const combo of combos) {
    it(`${label(combo)}: every page renders exactly one <Head>`, () => {
      for (const rel of pageTemplates) {
        expect(countHead(renderTemplate(rel, combo)), `${rel}`).toBe(1);
      }
    });

    it(`${label(combo)}: the route map owns one title, in its not-found page`, () => {
      // `routes.tsx` holds the layout wrappers AND the not-found route's
      // content, so it is the one file where a layout could quietly acquire a
      // second owner. Counting is not enough — moving the `<Head>` up into
      // `publicLayout` would keep the count at one — so the assertion also
      // says where it may appear: only from the not-found route onwards.
      const rendered = renderTemplate("src/routes.tsx.ejs", combo);
      const notFound = rendered.search(
        /^(?:function NotFoundPage|const notFoundRoute)/m,
      );

      expect(notFound).toBeGreaterThan(-1);
      expect(countHead(rendered.slice(0, notFound))).toBe(0);
      expect(countHead(rendered)).toBe(1);
    });

    it(`${label(combo)}: the entries render the Shell and own no title`, () => {
      const entries = combo.spa
        ? ["src/client/entry.tsx.ejs"]
        : ["src/client/entry.tsx.ejs", "src/server/entry.tsx.ejs"];

      for (const rel of entries) {
        const rendered = renderTemplate(rel, combo);

        expect(rendered, rel).toContain(
          'import Shell from "#lib/Shell/index.js";',
        );
        expect(rendered, rel).toContain("<Shell");
        expect(rendered, rel).not.toContain("HeadProvider");
        expect(countHead(rendered), rel).toBe(0);
      }
    });

    it(`${label(combo)}: the Shell installs the template and owns no title`, () => {
      const rendered = renderTemplate("src/lib/Shell/Shell.tsx.ejs", combo);

      expect(rendered).toContain(
        'import formatDocumentTitle from "../../formatDocumentTitle.js";',
      );
      expect(rendered).toContain(
        "<HeadProvider titleTemplate={formatDocumentTitle}>",
      );
      expect(countHead(rendered)).toBe(0);
    });

    it(`${label(combo)}: the title template carries the application name`, () => {
      expect(renderTemplate("src/formatDocumentTitle.ts.ejs", combo)).toContain(
        `\`\${pageTitle} — my-app\``,
      );
    });

    it(`${label(combo)}: the HTML shell titles itself only without a server`, () => {
      // Comments stripped first: both arms explain the rule in one, and the
      // explanation names the very element being looked for.
      const markup = renderTemplate("index.html.ejs", combo).replace(
        /<!--[\s\S]*?-->/g,
        "",
      );

      expect(markup.includes("<title>")).toBe(combo.spa);
    });
  }
});

/**
 * One provider nest, asserted on the rendered text.
 *
 * The client and the server entries must wrap the routes in the same
 * providers, in the same order, or the server markup and the hydrated tree
 * diverge. `Shell` is the one place that nest is written; an entry that grows
 * its own provider again would reintroduce the second copy without any syntax
 * error, so the entries are checked for the providers' absence as much as the
 * Shell is checked for their presence.
 */
describe("the rendered application renders one provider nest", () => {
  for (const combo of combos) {
    it(`${label(combo)}: the Shell holds the providers its flags select`, () => {
      const shell = renderTemplate("src/lib/Shell/Shell.tsx.ejs", combo);

      expect(shell.includes("<I18nProvider")).toBe(combo.intl);
      expect(shell.includes("<RelayEnvironmentProvider")).toBe(combo.relay);
      expect(shell).toContain("<RouterProvider");
      expect(shell).toContain("<Outlet");
    });

    it(`${label(combo)}: the entries hold no provider of their own`, () => {
      const entries = combo.spa
        ? ["src/client/entry.tsx.ejs"]
        : ["src/client/entry.tsx.ejs", "src/server/entry.tsx.ejs"];

      for (const rel of entries) {
        const rendered = renderTemplate(rel, combo);

        expect(rendered, rel).not.toContain("<I18nProvider");
        expect(rendered, rel).not.toContain("<RelayEnvironmentProvider");
        expect(rendered, rel).not.toContain("<RouterProvider");
      }
    });

    if (!combo.spa) {
      it(`${label(combo)}: the server renders the Shell inside #root`, () => {
        const server = renderTemplate("src/server/entry.tsx.ejs", combo);
        const root = server.match(/<div id="root">([\s\S]*?)<\/div>/)?.at(1);

        expect(root).toContain("<Shell");
      });
    }
  }
});

/**
 * The client's prefetch environment, asserted on the rendered text.
 *
 * Creating the router fires the matched route's warm, and a warm fills the
 * environment published when it runs. The client entry must publish its
 * environment before it creates the router, or that first warm finds nothing
 * to fill and the first query fetches on its own. Moving the call below the
 * router is no syntax error, so the order is checked here.
 */
describe("the client publishes its prefetch environment before routing", () => {
  for (const combo of combos.filter(({ relay }) => relay)) {
    it(`${label(combo)}: setPrefetchEnvironment runs before createRouter`, () => {
      const client = renderTemplate("src/client/entry.tsx.ejs", combo);
      const published = client.indexOf("setPrefetchEnvironment(");

      expect(published).toBeGreaterThan(-1);
      expect(published).toBeLessThan(client.indexOf("createRouter("));
    });
  }
});

/**
 * The server's records reach the client's store, asserted on the rendered text.
 *
 * The server embeds the records its warm fetched under one `__INITIAL_DATA__`
 * key and seeds its own render from them; the client must read that same key
 * and seed its store from it, or it hydrates with an empty store and refetches
 * the page the server already rendered. A renamed key or a dropped `records`
 * option is no syntax error, so the hand-off is checked on both sides here.
 */
describe("the client seeds its store from the server's records", () => {
  for (const combo of combos.filter(({ relay, spa }) => relay && !spa)) {
    it(`${label(combo)}: both entries hand the relayRecords key to createEnvironment`, () => {
      const server = renderTemplate("src/server/entry.tsx.ejs", combo);
      const client = renderTemplate("src/client/entry.tsx.ejs", combo);
      const embedded = client
        .match(/^const (\w+) = \([^;]*?\)\.__INITIAL_DATA__\?\.relayRecords;$/m)
        ?.at(1);

      expect(server).toContain("readonly relayRecords?: RelayRecords;");
      expect(server).toMatch(
        /createEnvironment\(\{\s*records: initialData\.relayRecords,\s*\}\)/,
      );
      expect(embedded).toBeDefined();
      expect(client).toMatch(
        new RegExp(
          `createEnvironment\\(\\{\\s*records: isRelayRecords\\(${embedded}\\)\\s*\\?\\s*${embedded}\\s*:\\s*undefined,\\s*\\}\\)`,
        ),
      );
    });
  }
});

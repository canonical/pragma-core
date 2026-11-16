import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GENERATOR_INVALID_ANSWER } from "@canonical/summon-core";
import { dryRun, type Effect, sequence_ } from "@canonical/task";
import { runTask, runUndo } from "@canonical/task/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generator as domainGenerator } from "../domain/index.js";
import { formatWithBiome } from "../testing/formatWithBiome.js";
import { generator as wrapperGenerator } from "../wrapper/index.js";
import { generator } from "./index.js";

/**
 * The page generator adds to an existing domain. In a dry run the virtual
 * filesystem starts empty, so the domain generator runs first in the same
 * sequence to "create" src/domains/<domain>/routes.ts — mirroring real usage
 * (`summon domain` then `summon page`).
 */
function dryRunPage(pagePath: string) {
  const [domainName] = pagePath.split("/");
  return dryRun(
    sequence_([
      domainGenerator.generate({ domainName }),
      generator.generate({ pagePath }),
    ]),
  );
}

/** Effects the page generator itself emitted (after the domain's). */
function pageEffects(pagePath: string): Effect[] {
  const [domainName] = pagePath.split("/");
  const domainCount = dryRun(domainGenerator.generate({ domainName })).effects
    .length;
  return dryRunPage(pagePath).effects.slice(domainCount);
}

const writes = (effects: Effect[]) =>
  effects.filter((e) => e._tag === "WriteFile") as Array<
    Effect & { path: string; content: string }
  >;

describe("page generator", () => {
  it("writes exactly one file, named by the page, and edits nothing", () => {
    const effects = pageEffects("invoices/detail");

    expect(writes(effects).map((e) => e.path)).toEqual([
      "src/domains/invoices/DetailPage.tsx",
    ]);
    const touching = effects.filter(
      (e) => e._tag !== "WriteFile" && e._tag !== "Exists" && e._tag !== "Log",
    );
    expect(touching).toEqual([]);
  });

  it("scaffolds the thin page", () => {
    const [page] = writes(pageEffects("invoices/order-lines"));

    expect(page.content).toBe(`import { Head } from "@canonical/react-head";
import type { ReactElement } from "react";

export default function OrderLinesPage(): ReactElement {
  return (
    <section aria-labelledby="order-lines-title">
      <Head title="Order Lines" />
      <h1 id="order-lines-title">Order Lines</h1>
    </section>
  );
}
`);
  });

  it("emits a page that Biome parses and leaves unchanged", () => {
    const [page] = writes(pageEffects("invoices/detail"));
    const { failures, formatted } = formatWithBiome({
      "DetailPage.tsx": page.content,
    });

    expect(failures).toBeNull();
    expect(formatted["DetailPage.tsx"]).toBe(page.content);
  });

  it("prints the routing guide as one message after writing", () => {
    const effects = pageEffects("invoices/detail");
    const messages = effects
      .filter((e) => e._tag === "Log")
      .map((e) => (e as { message: string }).message);

    // The guide's text is pinned in guide.test.ts.
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(
      /^Created src\/domains\/invoices\/DetailPage\.tsx\./,
    );
    expect(effects.at(-1)?._tag).toBe("Log");
  });

  it("rejects paths that are not exactly <domain>/<name>", () => {
    expect(() => dryRun(generator.generate({ pagePath: "detail" }))).toThrow(
      /at least 2 segments/,
    );
    expect(() =>
      dryRun(generator.generate({ pagePath: "invoices/detail/lines" })),
    ).toThrow(/at most 2 segments/);
    expect(() =>
      dryRun(generator.generate({ pagePath: "/invoices/detail" })),
    ).toThrow(/not an absolute path/);
    expect(() =>
      dryRun(generator.generate({ pagePath: "../invoices" })),
    ).toThrow(/"\.\."/);
  });

  it("refuses a page name that is not kebab-case, as an invalid answer", () => {
    for (const pagePath of [
      "invoices/DETAIL",
      "invoices/Detail",
      "invoices/order--lines",
    ]) {
      expect(() => dryRun(generator.generate({ pagePath }))).toThrow(
        expect.objectContaining({
          code: GENERATOR_INVALID_ANSWER,
          message: expect.stringContaining("must be kebab-case"),
        }),
      );
    }
  });

  it("refuses a page name whose route key JavaScript reserves, as an invalid answer", () => {
    for (const name of ["new", "delete", "default"]) {
      expect(() =>
        dryRun(generator.generate({ pagePath: `invoices/${name}` })),
      ).toThrow(
        expect.objectContaining({
          code: GENERATOR_INVALID_ANSWER,
          message: expect.stringContaining(`route key "${name}"`),
        }),
      );
    }
    // A name whose key is not itself reserved is fine.
    expect(() => pageEffects("invoices/new-invoice")).not.toThrow();
  });

  it("fails when the domain does not exist, as an invalid answer", () => {
    expect(() =>
      dryRun(generator.generate({ pagePath: "missing/page" })),
    ).toThrow(
      expect.objectContaining({
        code: GENERATOR_INVALID_ANSWER,
        message:
          'Domain "missing" not found: src/domains/missing/routes.ts is missing. Create the domain first.',
      }),
    );
  });
});

describe("page generator against the filesystem", () => {
  let cwd: string;
  const routes = "export default {};\n";
  const pageFile = () => path.join(cwd, "src/domains/catalog/DetailPage.tsx");
  const routesFile = () => path.join(cwd, "src/domains/catalog/routes.ts");

  beforeEach(() => {
    cwd = mkdtempSync(path.join(tmpdir(), "summon-page-"));
    mkdirSync(path.join(cwd, "src/domains/catalog"), { recursive: true });
    writeFileSync(routesFile(), routes);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("--undo deletes the page it wrote and nothing else", async () => {
    const task = () => generator.generate({ pagePath: "catalog/detail" });

    await runTask(task(), { cwd });
    expect(existsSync(pageFile())).toBe(true);

    const result = await runUndo(task(), { cwd });
    expect(result.undoCount).toBe(1);
    expect(existsSync(pageFile())).toBe(false);
    expect(readFileSync(routesFile(), "utf8")).toBe(routes);
  });

  it("refuses to overwrite an existing page", async () => {
    writeFileSync(pageFile(), "hand-written\n");

    await expect(
      runTask(generator.generate({ pagePath: "catalog/detail" }), { cwd }),
    ).rejects.toMatchObject({
      code: GENERATOR_INVALID_ANSWER,
      message: expect.stringContaining("already exists"),
    });
    expect(readFileSync(pageFile(), "utf8")).toBe("hand-written\n");
  });

  it("refuses the React page, domain and wrapper generators in a SvelteKit app", async () => {
    writeFileSync(path.join(cwd, "svelte.config.js"), "export default {};\n");
    writeFileSync(pageFile(), "user content\n");
    mkdirSync(path.join(cwd, "src/lib/SettingsLayout"), { recursive: true });
    writeFileSync(
      path.join(cwd, "src/lib/SettingsLayout/SettingsLayout.tsx"),
      "user content\n",
    );
    for (const task of [
      generator.generate({ pagePath: "catalog/detail" }),
      domainGenerator.generate({ domainName: "billing" }),
      wrapperGenerator.generate({ wrapperName: "settings" }),
    ]) {
      await runTask(task, { cwd });
      const undo = await runUndo(task, { cwd });
      expect(undo.undoCount).toBe(0);
    }
    expect(readFileSync(pageFile(), "utf8")).toBe("user content\n");
    expect(existsSync(path.join(cwd, "src/domains/billing"))).toBe(false);
    expect(
      readFileSync(
        path.join(cwd, "src/lib/SettingsLayout/SettingsLayout.tsx"),
        "utf8",
      ),
    ).toBe("user content\n");
  });

  it("creates SvelteKit domain, page and wrapper with reversible output", async () => {
    writeFileSync(path.join(cwd, "svelte.config.js"), "export default {};\n");
    const createDomain = () =>
      domainGenerator.generate({ domainName: "billing", framework: "svelte" });
    const createPage = () =>
      generator.generate({ pagePath: "billing/detail", framework: "svelte" });
    const createWrapper = () =>
      wrapperGenerator.generate({
        wrapperName: "settings",
        framework: "svelte",
      });
    await runTask(createDomain(), { cwd });
    await runTask(createPage(), { cwd });
    await runTask(createWrapper(), { cwd });
    expect(
      readFileSync(
        path.join(cwd, "src/routes/billing/detail/+page.svelte"),
        "utf8",
      ),
    ).toContain("<h1>Detail</h1>");
    expect(
      readFileSync(path.join(cwd, "src/lib/SettingsLayout.svelte"), "utf8"),
    ).toContain("{@render children?.()}");
    await runUndo(createPage(), { cwd });
    await runUndo(createWrapper(), { cwd });
    await runUndo(createDomain(), { cwd });
    expect(existsSync(path.join(cwd, "src/routes/billing/+page.svelte"))).toBe(
      false,
    );
    expect(existsSync(path.join(cwd, "src/lib/SettingsLayout.svelte"))).toBe(
      false,
    );
  });

  it("refuses existing Svelte output and preserves unrelated route files", async () => {
    const root = path.join(cwd, "src/routes/billing");
    mkdirSync(path.join(root, "detail"), { recursive: true });
    writeFileSync(path.join(root, "+page.svelte"), "domain\n");
    writeFileSync(path.join(root, "detail/+page.svelte"), "existing\n");
    writeFileSync(path.join(root, "other.txt"), "keep\n");
    await expect(
      runTask(
        generator.generate({ pagePath: "billing/detail", framework: "svelte" }),
        { cwd },
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("already exists"),
    });
    await expect(
      runTask(
        domainGenerator.generate({
          domainName: "billing",
          framework: "svelte",
        }),
        { cwd },
      ),
    ).rejects.toMatchObject({ code: "DOMAIN_EXISTS" });
    expect(readFileSync(path.join(root, "detail/+page.svelte"), "utf8")).toBe(
      "existing\n",
    );
    expect(readFileSync(path.join(root, "other.txt"), "utf8")).toBe("keep\n");
  });

  it("preserves existing nonempty domain directories on Svelte undo", async () => {
    const createDomain = () =>
      domainGenerator.generate({ domainName: "billing", framework: "svelte" });
    await runTask(createDomain(), { cwd });
    writeFileSync(path.join(cwd, "src/routes/billing/keep.txt"), "user\n");
    await runUndo(createDomain(), { cwd });
    expect(
      readFileSync(path.join(cwd, "src/routes/billing/keep.txt"), "utf8"),
    ).toBe("user\n");
  });

  it("refuses a Svelte page with no domain and preserves an existing wrapper", async () => {
    await expect(
      runTask(
        generator.generate({ pagePath: "missing/detail", framework: "svelte" }),
        { cwd },
      ),
    ).rejects.toMatchObject({
      code: GENERATOR_INVALID_ANSWER,
      message: expect.stringContaining("not found"),
    });
    mkdirSync(path.join(cwd, "src/lib"), { recursive: true });
    const wrapper = path.join(cwd, "src/lib/SettingsLayout.svelte");
    writeFileSync(wrapper, "user wrapper\n");
    await expect(
      runTask(
        wrapperGenerator.generate({
          wrapperName: "settings",
          framework: "svelte",
        }),
        { cwd },
      ),
    ).rejects.toMatchObject({ code: "WRAPPER_EXISTS" });
    expect(readFileSync(wrapper, "utf8")).toBe("user wrapper\n");
  });
});

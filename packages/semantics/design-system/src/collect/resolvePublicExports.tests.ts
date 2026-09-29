import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import resolvePublicExports, { importNameFor } from "./resolvePublicExports.js";

const roots: string[] = [];

/** Write a throwaway package tree; returns its root. */
function packageTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ds-exports-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("resolvePublicExports", () => {
  it("follows a barrel chain to the file a default export came from", async () => {
    const root = packageTree({
      "src/index.ts": 'export * from "./lib/index.js";',
      "src/lib/index.ts": 'export * from "./component/index.js";',
      "src/lib/component/index.ts": 'export * from "./Button/index.js";',
      "src/lib/component/Button/index.ts":
        'export { default as Button } from "./Button.js";\nexport type * from "./types.js";',
      "src/lib/component/Button/Button.tsx": "export default () => null;",
    });

    const exports = await resolvePublicExports(join(root, "src/index.ts"));
    const button = join(root, "src/lib/component/Button/Button.tsx");

    expect(importNameFor(exports, button)).toBe("Button");
  });

  // The case a file-name heuristic gets wrong: `Item.tsx` is only reachable as
  // `Breadcrumbs.Item`, so `import { Item }` would not resolve for a consumer.
  it("gives no name to a subcomponent the entry never re-exports", async () => {
    const root = packageTree({
      "src/index.ts": 'export * from "./component/index.js";',
      "src/component/index.ts": 'export * from "./Breadcrumbs/index.js";',
      "src/component/Breadcrumbs/index.ts":
        'export { default as Breadcrumbs } from "./Breadcrumbs.js";\nexport type { ItemProps } from "./common/index.js";',
      "src/component/Breadcrumbs/Breadcrumbs.tsx": "export default () => null;",
      "src/component/Breadcrumbs/common/index.ts":
        'export * from "./Item/index.js";',
      "src/component/Breadcrumbs/common/Item/index.ts":
        'export { default as Item } from "./Item.js";',
      "src/component/Breadcrumbs/common/Item/Item.tsx":
        "export default () => null;",
    });

    const exports = await resolvePublicExports(join(root, "src/index.ts"));

    expect(
      importNameFor(
        exports,
        join(root, "src/component/Breadcrumbs/Breadcrumbs.tsx"),
      ),
    ).toBe("Breadcrumbs");
    expect(
      importNameFor(
        exports,
        join(root, "src/component/Breadcrumbs/common/Item/Item.tsx"),
      ),
    ).toBeUndefined();
  });

  // Svelte's namespaced components build the export in the barrel rather than
  // re-exporting it, so no edge points at the component file by itself.
  it("attributes a locally declared export to its matching sibling file", async () => {
    const root = packageTree({
      "src/lib/index.ts": 'export * from "./Breadcrumbs/index.js";',
      "src/lib/Breadcrumbs/index.ts": [
        'import { default as BreadcrumbsRoot } from "./Breadcrumbs.svelte";',
        'import { Item } from "./common/index.js";',
        "const Breadcrumbs = BreadcrumbsRoot as typeof BreadcrumbsRoot & { Item: typeof Item };",
        "Breadcrumbs.Item = Item;",
        "export { Breadcrumbs };",
      ].join("\n"),
      "src/lib/Breadcrumbs/Breadcrumbs.svelte": "<div></div>",
      "src/lib/Breadcrumbs/common/index.ts": 'export * from "./Item/index.js";',
      "src/lib/Breadcrumbs/common/Item/index.ts":
        'export { default as Item } from "./Item.svelte";',
      "src/lib/Breadcrumbs/common/Item/Item.svelte": "<li></li>",
    });

    const exports = await resolvePublicExports(join(root, "src/lib/index.ts"));

    expect(
      importNameFor(
        exports,
        join(root, "src/lib/Breadcrumbs/Breadcrumbs.svelte"),
      ),
    ).toBe("Breadcrumbs");
    expect(
      importNameFor(
        exports,
        join(root, "src/lib/Breadcrumbs/common/Item/Item.svelte"),
      ),
    ).toBeUndefined();
  });

  it("does not follow type-only edges", async () => {
    const root = packageTree({
      "src/index.ts": 'export type * from "./Internal/index.js";',
      "src/Internal/index.ts":
        'export { default as Internal } from "./Internal.js";',
      "src/Internal/Internal.tsx": "export default () => null;",
    });

    const exports = await resolvePublicExports(join(root, "src/index.ts"));

    expect(
      importNameFor(exports, join(root, "src/Internal/Internal.tsx")),
    ).toBeUndefined();
  });

  it("honours an alias, so the published name wins over the file name", async () => {
    const root = packageTree({
      "src/index.ts": 'export { Inner as PublicName } from "./Inner.js";',
      "src/Inner.tsx": "export const Inner = () => null;",
    });

    const exports = await resolvePublicExports(join(root, "src/index.ts"));

    expect(importNameFor(exports, join(root, "src/Inner.tsx"))).toBe(
      "PublicName",
    );
  });

  it("survives a cycle between barrels", async () => {
    const root = packageTree({
      "src/index.ts": 'export * from "./a.js";',
      "src/a.ts": 'export * from "./b.js";\nexport const A = 1;',
      "src/b.ts": 'export * from "./a.js";\nexport const B = 2;',
    });

    const exports = await resolvePublicExports(join(root, "src/index.ts"));

    expect(importNameFor(exports, join(root, "src/a.ts"))).toBe("A");
  });

  it("returns nothing when the entry file does not exist", async () => {
    const root = packageTree({ "src/lib/thing.ts": "export const A = 1;" });

    const exports = await resolvePublicExports(join(root, "src/index.ts"));

    expect(exports.size).toBe(0);
  });
});

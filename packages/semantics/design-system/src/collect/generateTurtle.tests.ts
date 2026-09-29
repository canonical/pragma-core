import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  generateLibraryTurtle,
  generateObjectsTurtle,
} from "./generateTurtle.js";
import type { CollectConfig, ImplementsAnnotation } from "./types.js";

describe("generateLibraryTurtle", () => {
  const minimalConfig: CollectConfig = {
    name: "Test Library",
    platform: "react",
    link: "https://github.com/example/test",
    prefix: {
      short: "ds",
      namespace: "https://ds.canonical.com/",
    },
    pattern: "src/**/*.tsx",
  };

  it("should generate valid Turtle for minimal config", async () => {
    const ttl = await generateLibraryTurtle(minimalConfig);

    expect(ttl).toContain("@prefix ds: <https://ds.canonical.com/>");
    expect(ttl).toContain("ds:implementation.library.test-library");
    expect(ttl).toContain("a ds:ImplementationLibrary");
    expect(ttl).toContain('ds:libraryName "Test Library"');
    expect(ttl).toContain('ds:platform "react"');
    expect(ttl).toContain('ds:link "https://github.com/example/test"');
  });

  it("should include optional properties when provided", async () => {
    const fullConfig: CollectConfig = {
      ...minimalConfig,
      description: "A test library",
      documentation: "https://docs.example.com",
      tier: "ds:global",
    };

    const ttl = await generateLibraryTurtle(fullConfig);

    expect(ttl).toContain('ds:summary "A test library"');
    expect(ttl).toContain('ds:documentation "https://docs.example.com"');
    expect(ttl).toContain("ds:libraryTier ds:global");
  });

  it("should strip the npm scope when slugifying package names", async () => {
    const config: CollectConfig = {
      ...minimalConfig,
      name: "@canonical/react-ds-global",
    };

    const ttl = await generateLibraryTurtle(config);

    expect(ttl).toContain("ds:implementation.library.react-ds-global");
    expect(ttl).not.toContain("canonical-react-ds-global");
  });

  it("should slugify library name for URI", async () => {
    const config: CollectConfig = {
      ...minimalConfig,
      name: "Pragma React Components",
    };

    const ttl = await generateLibraryTurtle(config);

    expect(ttl).toContain("ds:implementation.library.pragma-react-components");
  });

  it("should throw error when using reserved prefix 'rdf'", () => {
    const config: CollectConfig = {
      ...minimalConfig,
      prefix: {
        short: "rdf",
        namespace: "https://example.com/data/",
      },
    };

    expect(() => generateLibraryTurtle(config)).toThrow(
      'Prefix "rdf" is reserved',
    );
  });

  it("should allow non-reserved prefixes", async () => {
    const config: CollectConfig = {
      ...minimalConfig,
      prefix: {
        short: "myprefix",
        namespace: "https://example.com/data/",
      },
    };

    const ttl = await generateLibraryTurtle(config);
    expect(ttl).toContain("@prefix myprefix: <https://example.com/data/>");
  });
});

describe("generateObjectsTurtle", () => {
  const config: CollectConfig = {
    name: "Test Library",
    platform: "react",
    link: "https://github.com/example/test",
    prefix: {
      short: "ds",
      namespace: "https://ds.canonical.com/",
    },
    pattern: "src/**/*.tsx",
  };

  it("should return empty string for empty annotations", async () => {
    const ttl = await generateObjectsTurtle(config, [], "/base");
    expect(ttl).toBe("");
  });

  it("should generate valid Turtle for annotations", async () => {
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: "/base/src/components/Button.tsx",
        blockUri: "ds:global.component.button",
      },
    ];

    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain("@prefix ds: <https://ds.canonical.com/>");
    expect(ttl).toContain("a ds:ImplementationObject");
    expect(ttl).toContain("ds:implementsBlock ds:global.component.button");
    expect(ttl).toContain('ds:headLink "src/components/Button.tsx"');
  });

  it("should include version when provided", async () => {
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: "/base/src/Card.tsx",
        blockUri: "ds:global.component.card",
        version: "1.2.3",
      },
    ];

    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain('ds:implementationVersion "1.2.3"');
  });

  it("should include isDraft when true", async () => {
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: "/base/src/Modal.tsx",
        blockUri: "ds:global.pattern.modal",
        isDraft: true,
      },
    ];

    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain('ds:isDraft "true"');
  });

  it("should generate multiple implementation objects", async () => {
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: "/base/src/Button.tsx",
        blockUri: "ds:global.component.button",
      },
      {
        filePath: "/base/src/Card.tsx",
        blockUri: "ds:global.component.card",
        version: "1.0.0",
      },
      {
        filePath: "/base/src/Modal.tsx",
        blockUri: "ds:global.pattern.modal",
        isDraft: true,
      },
    ];

    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    // Check that all annotations are included
    expect(ttl).toContain("ds:global.component.button");
    expect(ttl).toContain("ds:global.component.card");
    expect(ttl).toContain("ds:global.pattern.modal");
  });

  it("should use relative paths for headLink", async () => {
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: "/project/packages/react/src/deep/nested/Component.tsx",
        blockUri: "ds:component.test",
      },
    ];

    const ttl = await generateObjectsTurtle(
      config,
      annotations,
      "/project/packages/react",
    );

    expect(ttl).toContain('ds:headLink "src/deep/nested/Component.tsx"');
  });
});

describe("generateLibraryTurtle with release version", () => {
  const config: CollectConfig = {
    name: "Test Library",
    platform: "react",
    link: "https://github.com/example/test",
    prefix: {
      short: "ds",
      namespace: "https://ds.canonical.com/",
    },
    pattern: "src/**/*.tsx",
    version: "0.35.0",
  };

  it("should emit ds:version when a release version is configured", async () => {
    const ttl = await generateLibraryTurtle(config);

    expect(ttl).toContain('ds:version "0.35.0"');
  });

  it("should not emit ds:version without a release version", async () => {
    const ttl = await generateLibraryTurtle({ ...config, version: undefined });

    expect(ttl).not.toContain("ds:version");
  });
});

describe("generateObjectsTurtle named IRIs and links", () => {
  const config: CollectConfig = {
    name: "React DS Global",
    platform: "react",
    link: "https://github.com/canonical/pragma/tree/main/packages/react/ds-global",
    prefix: {
      short: "ds",
      namespace: "https://ds.canonical.com/",
    },
    pattern: "src/**/*.tsx",
    repository: "https://github.com/canonical/pragma",
    sourcePath: "packages/react/ds-global",
    version: "0.35.0",
  };

  const annotations: ImplementsAnnotation[] = [
    {
      filePath: "/base/src/lib/component/Chip/Chip.tsx",
      blockUri: "ds:global.component.chip",
    },
  ];

  it("should emit named IRIs instead of blank nodes", async () => {
    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain(
      "ds:implementation.react-ds-global.global.component.chip",
    );
    expect(ttl).not.toContain("_:");
    expect(ttl).not.toContain("[");
  });

  it("should link the library to the named implementation", async () => {
    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain("ds:implementation.library.react-ds-global");
    expect(ttl).toContain("ds:hasImplementation");
  });

  it("should emit full blob URLs for headLink when repository is set", async () => {
    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain(
      'ds:headLink "https://github.com/canonical/pragma/blob/main/packages/react/ds-global/src/lib/component/Chip/Chip.tsx"',
    );
  });

  it("should emit versionedLink pinned to the release tag", async () => {
    const ttl = await generateObjectsTurtle(config, annotations, "/base");

    expect(ttl).toContain(
      'ds:versionedLink "https://github.com/canonical/pragma/blob/v0.35.0/packages/react/ds-global/src/lib/component/Chip/Chip.tsx"',
    );
  });

  it("should not emit versionedLink without a release version", async () => {
    const ttl = await generateObjectsTurtle(
      { ...config, version: undefined },
      annotations,
      "/base",
    );

    expect(ttl).not.toContain("ds:versionedLink");
  });

  it("should disambiguate duplicate block implementations with a file slug", async () => {
    const duplicated: ImplementsAnnotation[] = [
      {
        filePath: "/base/src/lib/component/Chip/Chip.tsx",
        blockUri: "ds:global.component.chip",
      },
      {
        filePath: "/base/src/lib/component/Chip/variants/Dense.tsx",
        blockUri: "ds:global.component.chip",
      },
    ];

    const ttl = await generateObjectsTurtle(config, duplicated, "/base");

    expect(ttl).toContain(
      "ds:implementation.react-ds-global.global.component.chip a ds:ImplementationObject",
    );
    expect(ttl).toContain(
      "ds:implementation.react-ds-global.global.component.chip.component-dense a ds:ImplementationObject",
    );
  });

  it("should produce deterministic output regardless of annotation order", async () => {
    const shuffled: ImplementsAnnotation[] = [
      {
        filePath: "/base/src/lib/Modal.tsx",
        blockUri: "ds:global.pattern.modal",
      },
      {
        filePath: "/base/src/lib/component/Chip/Chip.tsx",
        blockUri: "ds:global.component.chip",
      },
    ];

    const forward = await generateObjectsTurtle(config, shuffled, "/base");
    const reversed = await generateObjectsTurtle(
      config,
      [...shuffled].reverse(),
      "/base",
    );

    expect(forward).toBe(reversed);
  });
});

describe("generateObjectsTurtle import statements", () => {
  const roots: string[] = [];

  function packageTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "ds-import-"));
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

  const config: CollectConfig = {
    name: "@canonical/react-ds-global",
    platform: "react",
    link: "https://github.com/canonical/pragma",
    prefix: { short: "ds", namespace: "https://ds.canonical.com/" },
    pattern: "src/**/*.tsx",
  };

  it("emits the published name, not the file name", async () => {
    const root = packageTree({
      "src/index.ts": 'export { default as Button } from "./Button.js";',
      "src/Button.tsx": "export default () => null;",
    });
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: join(root, "src/Button.tsx"),
        blockUri: "ds:global.component.button",
      },
    ];

    const ttl = await generateObjectsTurtle(config, annotations, root);

    expect(ttl).toContain(
      'ds:importStatement "import { Button } from \\"@canonical/react-ds-global\\";"',
    );
  });

  // An import a consumer cannot resolve is worse than no import at all.
  it("emits none for a file the package does not export", async () => {
    const root = packageTree({
      "src/index.ts": 'export { default as Card } from "./Card.js";',
      "src/Card.tsx": "export default () => null;",
      "src/common/Header.tsx": "export default () => null;",
    });
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: join(root, "src/common/Header.tsx"),
        blockUri: "ds:global.subcomponent.card-header",
      },
    ];

    const ttl = await generateObjectsTurtle(config, annotations, root);

    expect(ttl).toContain("ds:implementsBlock");
    expect(ttl).not.toContain("ds:importStatement");
  });

  it("finds the SvelteKit barrel without configuration", async () => {
    const root = packageTree({
      "src/lib/index.ts":
        'export { default as SkipLink } from "./SkipLink.svelte";',
      "src/lib/SkipLink.svelte": "<a></a>",
    });
    const annotations: ImplementsAnnotation[] = [
      {
        filePath: join(root, "src/lib/SkipLink.svelte"),
        blockUri: "ds:global.pattern.skip_link",
      },
    ];

    const ttl = await generateObjectsTurtle(
      { ...config, name: "@canonical/svelte-ds-global" },
      annotations,
      root,
    );

    expect(ttl).toContain("import { SkipLink }");
  });
});

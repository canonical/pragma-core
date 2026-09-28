import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RawArtifact, WorkerResponse } from "../types/index.js";
import createGraphWorker from "./createGraphWorker.js";

interface RuntimeFixture {
  rootDir: string;
  artifactPath: string;
  messages: WorkerResponse[];
  worker: ReturnType<typeof createGraphWorker>;
  cleanup: () => Promise<void>;
}

const BASE_ARTIFACT: RawArtifact = {
  version: "1.0.0",
  generator: "test",
  tokens: {
    "--color-fg": {
      cssVar: "--color-fg",
      id: "color.foreground",
      type: "color",
      value: "#111111",
      valueLight: "#111111",
      valueDark: "#111111",
      isPaired: false,
      description: "Foreground",
      tier: "semantic",
      sourceFile: "/project/tokens/color.tokens.json",
      sourceLine: 2,
      cssOutputFile: "/project/dist/tokens.css",
    },
    "--spacing-sm": {
      cssVar: "--spacing-sm",
      id: "spacing.small",
      type: "dimension",
      value: "8px",
      valueLight: "8px",
      valueDark: "8px",
      isPaired: false,
      description: "Spacing",
      tier: "primitive",
      sourceFile: "/project/tokens/spacing.tokens.json",
      sourceLine: 6,
      cssOutputFile: "/project/dist/tokens.css",
    },
  },
};

async function createRuntimeFixture(
  artifact: RawArtifact = BASE_ARTIFACT,
): Promise<RuntimeFixture> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "terrazzo-pr2-"));
  const artifactPath = path.join(rootDir, "dist", "tokens.json");
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(artifact), "utf-8");
  await fs.writeFile(
    path.join(rootDir, "terrazzo-lsp.config.json"),
    JSON.stringify({ artifacts: ["./dist/tokens.json"] }),
    "utf-8",
  );

  const messages: WorkerResponse[] = [];
  const worker = createGraphWorker({
    rootDir,
    postMessage: (message) => messages.push(message),
  });

  return {
    rootDir,
    artifactPath,
    messages,
    worker,
    cleanup: async () => {
      await fs.rm(rootDir, { recursive: true, force: true });
    },
  };
}

async function writeCssFile(
  rootDir: string,
  relativePath: string,
  source: string,
): Promise<string> {
  const filePath = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, source, "utf-8");
  return `file://${filePath}`;
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 750,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for runtime state");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describe("createGraphWorker regression baseline", () => {
  it("indexes imported files during OPEN_DOC", async () => {
    const fixture = await createRuntimeFixture();
    cleanups.push(fixture.cleanup);

    const importedUri = await writeCssFile(
      fixture.rootDir,
      "src/tokens.css",
      ":root { --brand-color: #e95420; }",
    );
    const rootUri = await writeCssFile(
      fixture.rootDir,
      "src/app.css",
      '@import "./tokens.css";\n.button { color: var(--brand-color); }',
    );

    await fixture.worker.handleRequest({
      id: 1,
      type: "OPEN_DOC",
      uri: rootUri,
      text: '@import "./tokens.css";\n.button { color: var(--brand-color); }',
    });

    expect(fixture.worker.graph.getImports(rootUri)?.has(importedUri)).toBe(
      true,
    );
    expect(
      fixture.worker.graph
        .getDeclarationsByFile(importedUri)
        .some((declaration) => declaration.cssVar === "--brand-color"),
    ).toBe(true);
  });

  it("updates the import graph when an import is added during CHANGE_DOC", async () => {
    const fixture = await createRuntimeFixture();
    cleanups.push(fixture.cleanup);

    const importedUri = await writeCssFile(
      fixture.rootDir,
      "src/tokens.css",
      ":root { --brand-color: #e95420; }",
    );
    const rootUri = await writeCssFile(
      fixture.rootDir,
      "src/app.css",
      ".button { color: red; }",
    );

    await fixture.worker.handleRequest({
      id: 2,
      type: "OPEN_DOC",
      uri: rootUri,
      text: ".button { color: red; }",
    });

    await fixture.worker.handleRequest({
      id: 3,
      type: "CHANGE_DOC",
      uri: rootUri,
      changes: [
        {
          text: '@import "./tokens.css";\n.button { color: var(--brand-color); }',
        },
      ],
    });

    await waitFor(
      () =>
        (fixture.worker.graph.getImports(rootUri)?.has(importedUri) ?? false) &&
        fixture.worker.graph
          .getDeclarationsByFile(importedUri)
          .some((declaration) => declaration.cssVar === "--brand-color"),
    );

    expect(fixture.worker.graph.getImports(rootUri)?.has(importedUri)).toBe(
      true,
    );
    expect(
      fixture.worker.graph
        .getDeclarationsByFile(importedUri)
        .some((declaration) => declaration.cssVar === "--brand-color"),
    ).toBe(true);
  });

  it("removes stale imported declarations when an import is removed during CHANGE_DOC", async () => {
    const fixture = await createRuntimeFixture();
    cleanups.push(fixture.cleanup);

    const importedUri = await writeCssFile(
      fixture.rootDir,
      "src/tokens.css",
      ":root { --brand-color: #e95420; }",
    );
    const rootUri = await writeCssFile(
      fixture.rootDir,
      "src/app.css",
      '@import "./tokens.css";\n.button { color: var(--brand-color); }',
    );

    await fixture.worker.handleRequest({
      id: 4,
      type: "OPEN_DOC",
      uri: rootUri,
      text: '@import "./tokens.css";\n.button { color: var(--brand-color); }',
    });

    await fixture.worker.handleRequest({
      id: 5,
      type: "CHANGE_DOC",
      uri: rootUri,
      changes: [
        {
          text: ".button { color: red; }",
        },
      ],
    });

    await waitFor(
      () => !fixture.worker.graph.getImports(rootUri)?.has(importedUri),
    );

    expect(fixture.worker.graph.getImports(rootUri)?.has(importedUri)).not.toBe(
      true,
    );
    expect(fixture.worker.graph.getDeclarationsByFile(importedUri).length).toBe(
      0,
    );
    expect(fixture.worker.graph.hasVar("--brand-color")).toBe(false);
  });

  it("reloads artifacts on ARTIFACT_CHANGED", async () => {
    const fixture = await createRuntimeFixture();
    cleanups.push(fixture.cleanup);

    const rootUri = await writeCssFile(
      fixture.rootDir,
      "src/app.css",
      ".button { color: var(--color-fg); }",
    );

    await fixture.worker.handleRequest({
      id: 6,
      type: "OPEN_DOC",
      uri: rootUri,
      text: ".button { color: var(--color-fg); }",
    });

    await fs.writeFile(
      fixture.artifactPath,
      JSON.stringify({
        ...BASE_ARTIFACT,
        tokens: {
          ...BASE_ARTIFACT.tokens,
          "--size-lg": {
            cssVar: "--size-lg",
            id: "size.large",
            type: "dimension",
            value: "16px",
            valueLight: "16px",
            valueDark: "16px",
            isPaired: false,
            description: "Large size",
            tier: "primitive",
            sourceFile: "/project/tokens/size.tokens.json",
            sourceLine: 10,
            cssOutputFile: "/project/dist/tokens.css",
          },
        },
      }),
      "utf-8",
    );

    await fixture.worker.handleRequest({
      id: 7,
      type: "ARTIFACT_CHANGED",
      path: fixture.artifactPath,
    });

    expect(fixture.worker.graph.hasToken("--size-lg")).toBe(true);
  });

  it("reindexes imported files after FILE_CHANGED", async () => {
    const fixture = await createRuntimeFixture();
    cleanups.push(fixture.cleanup);

    const importedPath = path.join(fixture.rootDir, "src", "tokens.css");
    const importedUri = await writeCssFile(
      fixture.rootDir,
      "src/tokens.css",
      ":root { --brand-color: #e95420; }",
    );
    const rootUri = await writeCssFile(
      fixture.rootDir,
      "src/app.css",
      '@import "./tokens.css";\n.button { color: var(--brand-color); }',
    );

    await fixture.worker.handleRequest({
      id: 8,
      type: "OPEN_DOC",
      uri: rootUri,
      text: '@import "./tokens.css";\n.button { color: var(--brand-color); }',
    });

    await fs.writeFile(
      importedPath,
      ":root { --brand-alt: #77216f; }",
      "utf-8",
    );

    await fixture.worker.handleRequest({
      id: 9,
      type: "FILE_CHANGED",
      uri: importedUri,
    });

    await waitFor(
      () =>
        fixture.worker.graph
          .getDeclarationsByFile(importedUri)
          .some((declaration) => declaration.cssVar === "--brand-alt") &&
        !fixture.worker.graph.hasVar("--brand-color"),
    );

    expect(
      fixture.worker.graph
        .getDeclarationsByFile(importedUri)
        .some((declaration) => declaration.cssVar === "--brand-alt"),
    ).toBe(true);
    expect(fixture.worker.graph.hasVar("--brand-color")).toBe(false);
  });

  it("preserves workspace symbol prefix filtering through the worker", async () => {
    const fixture = await createRuntimeFixture();
    cleanups.push(fixture.cleanup);

    await fixture.worker.handleRequest({
      id: 10,
      type: "WORKSPACE_SYMBOL",
      query: "type:dimension",
    });

    const message = fixture.messages.find(
      (response) =>
        response.type === "WORKSPACE_SYMBOL_RESULT" && response.id === 10,
    );

    expect(message?.type).toBe("WORKSPACE_SYMBOL_RESULT");
    if (message?.type !== "WORKSPACE_SYMBOL_RESULT") {
      throw new Error("Expected WORKSPACE_SYMBOL_RESULT");
    }
    expect(message.symbols.map((symbol) => symbol.name)).toEqual([
      "--spacing-sm",
    ]);
  });
});

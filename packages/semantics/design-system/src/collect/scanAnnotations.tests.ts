import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import scanAnnotations from "./scanAnnotations.js";

describe("scanAnnotations", () => {
  const testDir = join(tmpdir(), `scan-annotations-test-${Date.now()}`);

  beforeAll(async () => {
    await mkdir(join(testDir, "src", "components"), { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("should find basic @implements annotation", async () => {
    const filePath = join(testDir, "src", "components", "Button.tsx");
    await writeFile(
      filePath,
      `
/**
 * @implements ds:global.component.button
 */
export function Button() {}
`,
    );

    const annotations = await scanAnnotations("src/**/*.tsx", testDir);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].blockUri).toBe("ds:global.component.button");
    expect(annotations[0].version).toBeUndefined();
    expect(annotations[0].isDraft).toBeFalsy();
  });

  it("should find @implements annotation with version", async () => {
    const filePath = join(testDir, "src", "components", "Card.tsx");
    await writeFile(
      filePath,
      `
// @implements ds:global.component.card@1.2.3
export function Card() {}
`,
    );

    const annotations = await scanAnnotations("src/**/*.tsx", testDir);
    const cardAnnotation = annotations.find(
      (a) => a.blockUri === "ds:global.component.card",
    );
    expect(cardAnnotation).toBeDefined();
    expect(cardAnnotation?.version).toBe("1.2.3");
    expect(cardAnnotation?.isDraft).toBeFalsy();
  });

  it("should find @implements annotation with [draft] marker", async () => {
    const filePath = join(testDir, "src", "components", "Modal.tsx");
    await writeFile(
      filePath,
      `
// @implements ds:global.pattern.modal [draft]
export function Modal() {}
`,
    );

    const annotations = await scanAnnotations("src/**/*.tsx", testDir);
    const modalAnnotation = annotations.find(
      (a) => a.blockUri === "ds:global.pattern.modal",
    );
    expect(modalAnnotation).toBeDefined();
    expect(modalAnnotation?.isDraft).toBe(true);
  });

  it("should find @implements annotation with version and [draft]", async () => {
    const filePath = join(testDir, "src", "components", "Tabs.tsx");
    await writeFile(
      filePath,
      `
/**
 * Work in progress
 * @implements ds:global.component.tabs@0.1.0 [draft]
 */
export function Tabs() {}
`,
    );

    const annotations = await scanAnnotations("src/**/*.tsx", testDir);
    const tabsAnnotation = annotations.find(
      (a) => a.blockUri === "ds:global.component.tabs",
    );
    expect(tabsAnnotation).toBeDefined();
    expect(tabsAnnotation?.version).toBe("0.1.0");
    expect(tabsAnnotation?.isDraft).toBe(true);
  });

  it("should find multiple annotations in different files", async () => {
    // Clean existing files and create new ones
    const file1 = join(testDir, "src", "components", "A.tsx");
    const file2 = join(testDir, "src", "components", "B.tsx");

    await writeFile(file1, "// @implements prefix:one\nexport function A() {}");
    await writeFile(file2, "// @implements prefix:two\nexport function B() {}");

    const annotations = await scanAnnotations("src/**/*.tsx", testDir);
    const uris = annotations.map((a) => a.blockUri);
    expect(uris).toContain("prefix:one");
    expect(uris).toContain("prefix:two");
  });

  it("should return empty array if no annotations found", async () => {
    const emptyDir = join(testDir, "empty");
    await mkdir(join(emptyDir, "src"), { recursive: true });
    await writeFile(
      join(emptyDir, "src", "NoAnnotation.tsx"),
      "export function NoAnnotation() {}",
    );

    const annotations = await scanAnnotations("src/**/*.tsx", emptyDir);
    expect(annotations).toHaveLength(0);
  });

  it("should return empty array if no files match pattern", async () => {
    const annotations = await scanAnnotations("nonexistent/**/*.xyz", testDir);
    expect(annotations).toHaveLength(0);
  });

  it("should support pre-release versions", async () => {
    const filePath = join(testDir, "src", "components", "PreRelease.tsx");
    await writeFile(
      filePath,
      `
// @implements ds:component.test@1.0.0-beta.1
export function PreRelease() {}
`,
    );

    const annotations = await scanAnnotations("src/**/*.tsx", testDir);
    const preReleaseAnnotation = annotations.find(
      (a) => a.blockUri === "ds:component.test",
    );
    expect(preReleaseAnnotation).toBeDefined();
    expect(preReleaseAnnotation?.version).toBe("1.0.0-beta.1");
  });
});

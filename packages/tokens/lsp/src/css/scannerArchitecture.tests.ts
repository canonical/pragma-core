import * as fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

const scannerFiles = [
  new URL("./imports/extractCssImports.ts", import.meta.url),
  new URL("./scanners/scanProperties.ts", import.meta.url),
  new URL("./scanners/parseSuppressionDirectives.ts", import.meta.url),
  new URL("./scanners/scanUsages.ts", import.meta.url),
  new URL("./scanners/scanDeclarations.ts", import.meta.url),
];

describe("CSS scanner architecture", () => {
  it("uses parser traversal instead of regex-driven scanning", async () => {
    for (const fileUrl of scannerFiles) {
      const source = await fs.readFile(fileUrl, "utf-8");

      expect(source).not.toContain("matchAll(");
      expect(source).not.toContain("new RegExp(");
      expect(source).not.toContain(".exec(");
      expect(source).toContain("parseCSS");
    }
  });
});

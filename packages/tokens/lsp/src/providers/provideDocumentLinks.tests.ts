/**
 * Document links provider tests — TDD (P8.5 gate).
 */
import { describe, expect, it } from "vitest";
import provideDocumentLinks from "./provideDocumentLinks.js";

describe("provideDocumentLinks", () => {
  it("returns empty for CSS with no @import", () => {
    const source = ".box { color: red; }";
    expect(provideDocumentLinks(source, "file:///app.css")).toEqual([]);
  });

  it("returns a link for a simple @import (P8.5)", () => {
    const source = '@import "tokens.css";';
    const links = provideDocumentLinks(source, "file:///src/app.css");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("file:///src/tokens.css");
    expect(links[0].range.start.line).toBe(0);
    expect(links[0].range.start.character).toBe(source.indexOf("tokens.css"));
    expect(links[0].range.end.character).toBe(
      source.indexOf("tokens.css") + "tokens.css".length,
    );
  });

  it("handles url() imports", () => {
    const source = '@import url("theme.css");';
    const links = provideDocumentLinks(source, "file:///styles/main.css");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("file:///styles/theme.css");
  });

  it("handles multiple imports", () => {
    const source = [
      '@import "tokens.css";',
      '@import "theme.css";',
      ".box { color: red; }",
    ].join("\n");
    const links = provideDocumentLinks(source, "file:///src/app.css");
    expect(links).toHaveLength(2);
    expect(links[0].target).toBe("file:///src/tokens.css");
    expect(links[1].target).toBe("file:///src/theme.css");
  });

  it("resolves relative paths with ../ correctly", () => {
    const source = '@import "../shared/tokens.css";';
    const links = provideDocumentLinks(
      source,
      "file:///project/src/styles/app.css",
    );
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("file:///project/src/shared/tokens.css");
  });
});

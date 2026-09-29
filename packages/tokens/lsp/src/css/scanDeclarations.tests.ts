import { describe, expect, it } from "vitest";
import scanDeclarations from "./scanners/scanDeclarations.js";

describe("scanDeclarations", () => {
  it("scans a simple :root declaration", () => {
    const source = `:root {
  --color-bg: #fff;
}`;
    const decls = scanDeclarations(source, "file:///a.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].cssVar).toBe("--color-bg");
    expect(decls[0].rawValue).toBe("#fff");
    expect(decls[0].fileUri).toBe("file:///a.css");
    expect(decls[0].line).toBe(1);
    expect(decls[0].selector.selector).toBe(":root");
    expect(decls[0].selector.scopeType).toBe("global");
  });

  it("scans multiple declarations", () => {
    const source = `:root {
  --a: red;
  --b: blue;
}`;
    const decls = scanDeclarations(source, "file:///a.css");
    expect(decls).toHaveLength(2);
    expect(decls[0].cssVar).toBe("--a");
    expect(decls[1].cssVar).toBe("--b");
  });

  it("scans class-scoped declarations", () => {
    const source = `.button {
  --button-pad: 12px;
}`;
    const decls = scanDeclarations(source, "file:///b.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].selector.selector).toBe(".button");
    expect(decls[0].selector.scopeType).toBe("class");
    expect(decls[0].selector.isScoped).toBe(true);
  });

  it("scans declarations inside @media", () => {
    const source = `@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #000;
  }
}`;
    const decls = scanDeclarations(source, "file:///c.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].selector.scopeType).toBe("media");
    expect(decls[0].selector.atRules).toHaveLength(1);
    expect(decls[0].selector.atRules[0].name).toBe("media");
  });

  it("infers CSS type from colour values", () => {
    const source = `:root { --x: oklch(50% 0.2 260); }`;
    const decls = scanDeclarations(source, "file:///d.css");
    expect(decls[0].cssType).toBe("<color>");
  });

  it("infers CSS type from dimension values", () => {
    const source = `:root { --x: 24px; }`;
    const decls = scanDeclarations(source, "file:///e.css");
    expect(decls[0].cssType).toBe("<length>");
  });

  it("infers CSS type from hex colour", () => {
    const source = `:root { --x: #ff0000; }`;
    const decls = scanDeclarations(source, "file:///f.css");
    expect(decls[0].cssType).toBe("<color>");
  });

  it("scans multi-line declaration values", () => {
    const source = `:root {
  --shadow:
    0 1px 2px rgb(0 0 0 / 0.2);
}`;
    const decls = scanDeclarations(source, "file:///shadow.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].rawValue).toBe("0 1px 2px rgb(0 0 0 / 0.2)");
  });

  it("ignores braces inside comments and strings", () => {
    const source = `:root {
  /* { not a block } */
  --content: "{";
}`;
    const decls = scanDeclarations(source, "file:///strings.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].rawValue).toBe('"{"');
  });

  it("captures nested selector context", () => {
    const source = `.button {
  & .icon {
    --icon-size: 1rem;
  }
}`;
    const decls = scanDeclarations(source, "file:///nested.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].selector.selector).toContain("& .icon");
  });

  it("captures layer context", () => {
    const source = `@layer ds.tokens {
  :root { --color-bg: #fff; }
}`;
    const decls = scanDeclarations(source, "file:///layer.css");
    expect(decls).toHaveLength(1);
    expect(decls[0].selector.atRules[0]).toEqual({
      name: "layer",
      prelude: "ds.tokens",
    });
  });
});

import { describe, expect, it } from "vitest";
import extractJsImports from "./extractJsImports.js";

describe("extractJsImports", () => {
  it("extracts static CSS import", () => {
    const js = "import './styles.css';";
    expect(extractJsImports(js)).toEqual(["./styles.css"]);
  });

  it("extracts named CSS import", () => {
    const js = "import styles from './Button.css';";
    expect(extractJsImports(js)).toEqual(["./Button.css"]);
  });

  it("extracts SCSS import", () => {
    const js = "import './theme.scss';";
    expect(extractJsImports(js)).toEqual(["./theme.scss"]);
  });

  it("ignores non-CSS imports", () => {
    const js = "import { useState } from 'react';\nimport './styles.css';";
    expect(extractJsImports(js)).toEqual(["./styles.css"]);
  });

  it("returns empty for JS with no CSS imports", () => {
    const js = "import { useState } from 'react';\nconst x = 1;";
    expect(extractJsImports(js)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import scanProperties from "./scanners/scanProperties.js";

describe("scanProperties", () => {
  it("scans a simple @property block", () => {
    const source = `@property --accent {
  syntax: "<color>";
  inherits: true;
  initial-value: blue;
}`;
    const props = scanProperties(source, "file:///theme.css");
    expect(props).toHaveLength(1);
    expect(props[0].cssVar).toBe("--accent");
    expect(props[0].syntax).toBe("<color>");
    expect(props[0].inherits).toBe(true);
    expect(props[0].initialValue).toBe("blue");
    expect(props[0].cssType).toBe("<color>");
  });

  it("scans @property with inherits: false", () => {
    const source = `@property --size {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}`;
    const props = scanProperties(source, "file:///size.css");
    expect(props[0].inherits).toBe(false);
    expect(props[0].cssType).toBe("<length>");
  });

  it("scans multiple @property blocks", () => {
    const source = `@property --a {
  syntax: "<color>";
  inherits: true;
  initial-value: red;
}
@property --b {
  syntax: "<length>";
  inherits: false;
  initial-value: 0;
}`;
    const props = scanProperties(source, "file:///multi.css");
    expect(props).toHaveLength(2);
    expect(props[0].cssVar).toBe("--a");
    expect(props[1].cssVar).toBe("--b");
  });

  it("handles @property without initial-value", () => {
    const source = `@property --x {
  syntax: "<number>";
  inherits: true;
}`;
    const props = scanProperties(source, "file:///no-init.css");
    expect(props[0].initialValue).toBeNull();
  });

  it("handles descriptor values containing a closing brace", () => {
    const source = `@property --icon {
  syntax: "<string>";
  inherits: false;
  initial-value: "}";
}`;
    const props = scanProperties(source, "file:///icon.css");
    expect(props).toHaveLength(1);
    expect(props[0].initialValue).toBe('"}"');
  });
});

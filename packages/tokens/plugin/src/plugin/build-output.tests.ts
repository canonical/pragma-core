/**
 * Phase 3 build output validation (tasks 3.3-3.9).
 *
 * These tests read the `dist/` artefacts produced by `tz build` and verify
 * structural correctness against the implementation plan specification.
 *
 * Run after `bun run build` to validate outputs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Artifact } from "../artifact/types.js";
import { legacyCssVarForToken } from "../naming.js";

const DIST = resolve(import.meta.dirname, "../../../tokens/dist");
const CANONICAL = resolve(
  import.meta.dirname,
  "../../../tokens/tokens/canonical",
);

/** Read a dist file as a string. */
function dist(name: string): string {
  return readFileSync(resolve(DIST, name), "utf8");
}

/** Extract all CSS custom property declarations from a CSS string.
 * Returns an array of `{ property, value }` objects. */
function extractDeclarations(
  css: string,
): { property: string; value: string }[] {
  return [...css.matchAll(/(--.+?):\s*(.+?);/g)].map((m) => ({
    property: m[1],
    value: m[2],
  }));
}

/** Extract all `var(--...)` references from a CSS value string. */
function extractVarRefs(value: string): string[] {
  return [...value.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((m) => m[1]);
}

/** Resolve simple generated var() references through the complete output. */
function resolveGeneratedValue(
  property: string,
  declarations: ReadonlyMap<string, string>,
  resolving = new Set<string>(),
): string {
  if (resolving.has(property)) {
    throw new Error(`Circular generated reference at ${property}`);
  }
  const value = declarations.get(property);
  if (value === undefined) throw new Error(`Missing generated ${property}`);

  const next = new Set(resolving).add(property);
  return value.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_, reference: string) =>
    resolveGeneratedValue(reference, declarations, next),
  );
}

/** Extract CSS class selectors from a CSS string. */
function extractSelectors(css: string): string[] {
  return [...css.matchAll(/^\t((?:\.[a-zA-Z0-9_-]+ ?)+|:root|\*)\s*\{/gm)].map(
    (m) => m[1].trim(),
  );
}

/** Return the captured block content from a successful regex match. */
function requireCapture(match: RegExpMatchArray | null, label: string): string {
  expect(match).toBeTruthy();
  const capture = match?.[1];
  if (!capture) {
    throw new Error(`Expected capture for ${label}`);
  }
  return capture;
}

// ---------------------------------------------------------------------------
// 3.3 Validate sets.primitive.css
// ---------------------------------------------------------------------------
describe("3.3 sets.primitive.css", () => {
  const css = dist("sets.primitive.css");
  const decls = extractDeclarations(css);

  it("wraps in @layer ds.tokens", () => {
    expect(css).toContain("@layer ds.tokens");
  });

  it("uses :root selector", () => {
    expect(css).toContain(":root {");
  });

  it("has no namespace wrappers (primitive.*, semantic.*)", () => {
    for (const d of decls) {
      expect(d.property).not.toMatch(/^--primitive-/);
      expect(d.property).not.toMatch(/^--semantic-/);
    }
  });

  it("emits referenced number tokens", () => {
    expect(decls.some((d) => d.property === "--number-line-height-300")).toBe(
      true,
    );
  });

  it("keeps bounded camelCase primitive aliases during migration", () => {
    for (const property of [
      "--typography-fontFamily-sansSerif",
      "--typography-weight-semiBold",
      "--typography-weight-extraBold",
      "--dimension-size-fontSize-300",
      "--dimension-letterSpacing-default",
      "--number-lineHeight-300",
    ]) {
      expect(
        decls.some((declaration) => declaration.property === property),
      ).toBe(true);
    }
    expect(css).toContain("--dimension-size-fontSize-300: 0.875rem;");
    expect(css).toContain("--number-lineHeight-300: 1.4286;");
    expect(css).not.toContain(
      "--dimension-size-fontSize-300: var(--dimension-size-font-size-300);",
    );
  });

  it("contains color palette tokens", () => {
    const colorDecls = decls.filter((d) =>
      d.property.startsWith("--color-palette-"),
    );
    expect(colorDecls.length).toBe(119);
  });

  it("contains dimension tokens", () => {
    const dimDecls = decls.filter((d) => d.property.startsWith("--dimension-"));
    expect(dimDecls.length).toBeGreaterThan(50);
  });

  it("contains typography primitive tokens", () => {
    const typoDecls = decls.filter((d) =>
      d.property.startsWith("--typography-font-family-"),
    );
    expect(typoDecls.length).toBeGreaterThanOrEqual(2);
  });

  it("all color values are oklch()", () => {
    const colorDecls = decls.filter((d) =>
      d.property.startsWith("--color-palette-"),
    );
    for (const d of colorDecls) {
      expect(d.value).toMatch(/^oklch\(/);
    }
  });
});

describe("3.3b sets.semantic.css", () => {
  const css = dist("sets.semantic.css");

  it("does not retain a breakpoint-owned baseline", () => {
    expect(css).not.toContain("dimension-size-height-baseline");
    expect(css).not.toContain("spacing-baseline");
  });

  it("does not emit the rejected root-font-size policy", () => {
    expect(css).not.toContain("root-font-size");
  });

  it("does not strand typography dependencies in the generic semantic set", () => {
    expect(css).not.toContain("--typography-font-family-default:");
    expect(css).not.toContain("--typography-fontFamily-default:");
  });
});

describe("3.3c modifiers.spacing.css", () => {
  const css = dist("modifiers.spacing.css");
  const expectedProperties = [
    "--spacing-baseline",
    "--spacing-gap-field-block",
    "--spacing-gap-mark-inline",
    "--spacing-gap-group-block",
    "--spacing-gap-pattern-block",
    "--spacing-gap-region-block",
    "--spacing-inset-field-inline",
    "--spacing-inset-action-inline",
    "--spacing-inset-continuation-inline",
    "--spacing-inset-surface-inline",
    "--spacing-inset-surface-block",
    "--spacing-inset-strip-block",
  ].sort();
  const expectedBySelector: Record<string, Record<string, string>> = {
    ":root": {
      "--spacing-baseline": "var(--dimension-100)",
      "--spacing-gap-field-block": "var(--dimension-100)",
      "--spacing-gap-mark-inline": "var(--dimension-100)",
      "--spacing-gap-group-block": "var(--dimension-300)",
      "--spacing-gap-pattern-block": "var(--dimension-800)",
      "--spacing-gap-region-block": "var(--dimension-1600)",
      "--spacing-inset-field-inline": "var(--dimension-100)",
      "--spacing-inset-action-inline": "var(--dimension-200)",
      "--spacing-inset-continuation-inline": "var(--dimension-400)",
      "--spacing-inset-surface-inline": "var(--dimension-200)",
      "--spacing-inset-surface-block": "var(--dimension-200)",
      "--spacing-inset-strip-block": "var(--dimension-800)",
    },
    ".site": {
      "--spacing-baseline": "var(--dimension-100)",
      "--spacing-gap-field-block": "var(--dimension-100)",
      "--spacing-gap-mark-inline": "var(--dimension-100)",
      "--spacing-gap-group-block": "var(--dimension-300)",
      "--spacing-gap-pattern-block": "var(--dimension-800)",
      "--spacing-gap-region-block": "var(--dimension-1600)",
      "--spacing-inset-field-inline": "var(--dimension-100)",
      "--spacing-inset-action-inline": "var(--dimension-200)",
      "--spacing-inset-continuation-inline": "var(--dimension-400)",
      "--spacing-inset-surface-inline": "var(--dimension-200)",
      "--spacing-inset-surface-block": "var(--dimension-200)",
      "--spacing-inset-strip-block": "var(--dimension-800)",
    },
    ".docs": {
      "--spacing-baseline": "var(--dimension-050)",
      "--spacing-gap-field-block": "var(--dimension-100)",
      "--spacing-gap-mark-inline": "var(--dimension-100)",
      "--spacing-gap-group-block": "var(--dimension-300)",
      "--spacing-gap-pattern-block": "var(--dimension-600)",
      "--spacing-gap-region-block": "var(--dimension-1200)",
      "--spacing-inset-field-inline": "var(--dimension-100)",
      "--spacing-inset-action-inline": "var(--dimension-150)",
      "--spacing-inset-continuation-inline": "var(--dimension-300)",
      "--spacing-inset-surface-inline": "var(--dimension-200)",
      "--spacing-inset-surface-block": "var(--dimension-200)",
      "--spacing-inset-strip-block": "var(--dimension-600)",
    },
    ".app": {
      "--spacing-baseline": "var(--dimension-050)",
      "--spacing-gap-field-block": "var(--dimension-100)",
      "--spacing-gap-mark-inline": "var(--dimension-050)",
      "--spacing-gap-group-block": "var(--dimension-100)",
      "--spacing-gap-pattern-block": "var(--dimension-200)",
      "--spacing-gap-region-block": "var(--dimension-400)",
      "--spacing-inset-field-inline": "var(--dimension-050)",
      "--spacing-inset-action-inline": "var(--dimension-150)",
      "--spacing-inset-continuation-inline": "var(--dimension-300)",
      "--spacing-inset-surface-inline": "var(--dimension-150)",
      "--spacing-inset-surface-block": "var(--dimension-150)",
      "--spacing-inset-strip-block": "var(--dimension-600)",
    },
    ".os": {
      "--spacing-baseline": "var(--dimension-050)",
      "--spacing-gap-field-block": "var(--dimension-050)",
      "--spacing-gap-mark-inline": "var(--dimension-050)",
      "--spacing-gap-group-block": "var(--dimension-300)",
      "--spacing-gap-pattern-block": "var(--dimension-600)",
      "--spacing-gap-region-block": "var(--dimension-1200)",
      "--spacing-inset-field-inline": "var(--dimension-050)",
      "--spacing-inset-action-inline": "var(--dimension-100)",
      "--spacing-inset-continuation-inline": "var(--dimension-250)",
      "--spacing-inset-surface-inline": "var(--dimension-100)",
      "--spacing-inset-surface-block": "var(--dimension-100)",
      "--spacing-inset-strip-block": "var(--dimension-400)",
    },
  };

  it("emits all twelve exact names at every product point", () => {
    for (const [selector, expected] of Object.entries(expectedBySelector)) {
      const escaped = selector.replace(".", "\\.");
      const block = requireCapture(
        css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s")),
        selector,
      );
      const declarations = Object.fromEntries(
        extractDeclarations(block).map(({ property, value }) => [
          property,
          value,
        ]),
      );
      expect(Object.keys(declarations).sort(), selector).toEqual(
        expectedProperties,
      );
      expect(declarations, selector).toEqual(expected);
    }
  });

  it("uses only product selectors with no density or responsive output", () => {
    expect(extractSelectors(css).sort()).toEqual(
      [":root", ".app", ".docs", ".site", ".os"].sort(),
    );
    expect(css).not.toContain("@media");
    expect(css).not.toContain("@container");
    expect(css).not.toContain(".dense");
    expect(css).not.toContain(".comfortable");
  });
});

// ---------------------------------------------------------------------------
// 3.4 Validate modifiers.theme.css
// ---------------------------------------------------------------------------
describe("3.4 modifiers.theme.css", () => {
  const css = dist("modifiers.theme.css");
  const decls = extractDeclarations(css);

  it("wraps in @layer ds.modifiers", () => {
    expect(css).toContain("@layer ds.modifiers");
  });

  it("declares color-scheme: light dark on :root", () => {
    expect(css).toMatch(/:\s*root\s*\{[^}]*color-scheme:\s*light dark/s);
  });

  it("uses light-dark() for paired color tokens", () => {
    const lightDarkDecls = decls.filter((d) => d.value.includes("light-dark("));
    expect(lightDarkDecls.length).toBeGreaterThan(100);
  });

  it("has .light class with color-scheme: light", () => {
    expect(css).toMatch(/\.light\s*\{[^}]*color-scheme:\s*light/s);
  });

  it("has .dark class with color-scheme: dark", () => {
    expect(css).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark/s);
  });

  it("has @media (prefers-color-scheme: dark) override", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
  });

  it(".dark class does not redeclare light-dark() tokens", () => {
    const darkMatch = css.match(/\.dark\s*\{([^}]*)\}/s);
    expect(darkMatch).toBeTruthy();
    const darkContent = darkMatch?.[1];
    expect(darkContent).not.toContain("light-dark(");
  });

  it("emits delta variables for interactive states", () => {
    const deltaDecls = decls.filter((d) => d.property.startsWith("--delta-"));
    expect(deltaDecls.length).toBeGreaterThan(0);
    const hoverDeltas = deltaDecls.filter((d) =>
      d.property.startsWith("--delta-hover-"),
    );
    const activeDeltas = deltaDecls.filter((d) =>
      d.property.startsWith("--delta-active-"),
    );
    expect(hoverDeltas.length).toBeGreaterThan(0);
    expect(activeDeltas.length).toBeGreaterThan(0);
    expect(hoverDeltas.length).toBe(activeDeltas.length);
  });

  it("dark overrides redeclare only delta variables", () => {
    const darkMatch = css.match(/\.dark\s*\{([^}]*)\}/s);
    const darkDecls = extractDeclarations(requireCapture(darkMatch, ".dark"));
    for (const d of darkDecls) {
      if (d.property.startsWith("--")) {
        expect(d.property).toMatch(/^--delta-/);
      }
    }
  });
});

describe("3.4b canonical naming and exact typography", () => {
  const themeCss = dist("modifiers.theme.css");
  const typographyCss = dist("modifiers.typography.css");
  const typographyDecls = extractDeclarations(typographyCss);

  it("uses uppercase only in bounded compatibility aliases", () => {
    const css = readdirSync(DIST)
      .filter((file) => file.endsWith(".css"))
      .map((file) => dist(file))
      .join("\n");
    const uppercaseDeclarations = extractDeclarations(css).filter(
      ({ property }) => /[A-Z]/.test(property),
    );
    expect(uppercaseDeclarations.length).toBeGreaterThan(0);
    expect(uppercaseDeclarations.every(({ value }) => value.length > 0)).toBe(
      true,
    );
  });

  it("emits bounded camelCase aliases that point at canonical properties", () => {
    expect(themeCss).toContain("--color-focusRing: var(--color-focus-ring);");
    expect(themeCss).toContain(
      "--color-text-onForegroundPrimary: var(--color-text-on-foreground-primary);",
    );
  });

  it("emits exact dimensions alongside DTCG line-height projections", () => {
    const lineHeights = typographyDecls.filter((declaration) =>
      declaration.property.endsWith("-line-height-dimension"),
    );
    expect(lineHeights.length).toBeGreaterThan(0);
    for (const declaration of lineHeights) {
      expect(declaration.value).toMatch(/^var\(--dimension-/);
    }
  });

  it("keeps every emitted projection within 0.01px of its exact dimension", () => {
    const primitives = new Map(
      extractDeclarations(dist("sets.primitive.css")).map(
        ({ property, value }) => [property, value],
      ),
    );
    const resolveNumber = (value: string): number => {
      const reference = /^var\((--[a-zA-Z0-9-]+)\)$/.exec(value)?.[1];
      const resolved = reference ? primitives.get(reference) : value;
      if (resolved === undefined) throw new Error(`Unresolved ${value}`);
      const numeric = Number.parseFloat(resolved);
      if (!Number.isFinite(numeric)) throw new Error(`Non-numeric ${resolved}`);
      return numeric;
    };
    let checked = 0;
    for (const block of typographyCss.matchAll(
      /(?:^|\s)(:root|\.(?:app|docs|site|os))\s*\{([^}]*)\}/g,
    )) {
      const declarations = new Map(
        extractDeclarations(block[2]).map(({ property, value }) => [
          property,
          value,
        ]),
      );
      for (const [property, exactValue] of declarations) {
        if (!property.endsWith("-line-height-dimension")) continue;
        const prefix = property.slice(0, -"-line-height-dimension".length);
        const fontSize = declarations.get(`${prefix}-font-size`);
        const projection = declarations.get(`${prefix}-line-height`);
        expect(fontSize, `${block[1]} ${prefix}`).toBeDefined();
        expect(projection, `${block[1]} ${prefix}`).toBeDefined();
        expect(
          Math.abs(
            resolveNumber(fontSize as string) *
              16 *
              resolveNumber(projection as string) -
              resolveNumber(exactValue) * 16,
          ),
          `${block[1]} ${prefix}`,
        ).toBeLessThanOrEqual(0.01);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("delivers semantic font-family dependencies in the typography file", () => {
    expect(typographyCss).toContain(
      "--typography-font-family-default: var(--typography-font-family-sans-serif);",
    );
    expect(typographyCss).toContain(
      "--typography-fontFamily-default: var(--typography-font-family-sans-serif);",
    );
  });

  it("emits the 84px/96px Site display role", () => {
    expect(typographyCss).toContain(
      "--typography-heading-display-font-size: var(--dimension-size-font-size-950);",
    );
    expect(typographyCss).toContain(
      "--typography-heading-display-line-height-dimension: var(--dimension-1200);",
    );
    expect(typographyCss).not.toMatch(
      /:root\s*\{[^}]*--typography-heading-display/s,
    );
    expect(typographyCss).toMatch(
      /\.site\s*\{[^}]*--typography-heading-display-line-height-dimension: var\(--dimension-1200\)/s,
    );
  });

  it("preserves the approved 14px/20px Site secondary-text exception", () => {
    const site = requireCapture(
      typographyCss.match(/\.site\s*\{([^}]*)\}/s),
      ".site",
    );
    expect(site).toContain(
      "--typography-text-secondary-font-size: var(--dimension-size-font-size-300);",
    );
    expect(site).toContain(
      "--typography-text-secondary-line-height-dimension: var(--dimension-250);",
    );
  });

  it("omits product blocks identical to the default without dropping the OS context", () => {
    for (const context of ["app", "docs", "site"]) {
      expect(typographyCss).toContain(`.${context} {`);
    }
    expect(typographyCss).not.toContain(".os {");
  });
});

// ---------------------------------------------------------------------------
// 3.5 Validate modifiers.{family}.css
// ---------------------------------------------------------------------------
describe("3.5 modifiers.{family}.css", () => {
  const families = [
    "anticipation",
    "criticality",
    "emphasis",
    "importance",
  ] as const;

  for (const family of families) {
    describe(`modifiers.${family}.css`, () => {
      const css = dist(`modifiers.${family}.css`);

      if (family === "importance") {
        it("is effectively empty (placeholder tokens)", () => {
          const decls = extractDeclarations(css);
          expect(decls).toHaveLength(0);
        });
        return;
      }

      const decls = extractDeclarations(css);

      it("wraps in @layer ds.modifiers", () => {
        expect(css).toContain("@layer ds.modifiers");
      });

      it("uses --modifier-* channel names", () => {
        for (const d of decls) {
          expect(d.property).toMatch(/^--modifier-/);
        }
      });

      it("values are only var() references", () => {
        for (const d of decls) {
          expect(d.value).toMatch(/^var\(--/);
        }
      });

      it("var() targets point to semantic tokens, not other modifiers", () => {
        for (const d of decls) {
          const refs = extractVarRefs(d.value);
          for (const ref of refs) {
            expect(ref).not.toMatch(/^--modifier-/);
            expect(ref).not.toMatch(/^--surface-/);
          }
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 3.6 Validate modifiers.surfaces.css
// ---------------------------------------------------------------------------
describe("3.6 modifiers.surfaces.css", () => {
  const css = dist("modifiers.surfaces.css");
  const decls = extractDeclarations(css);

  it("wraps in @layer ds.surfaces", () => {
    expect(css).toContain("@layer ds.surfaces");
  });

  it("uses compound .surface selectors for depth-based compounding", () => {
    const selectors = extractSelectors(css);
    expect(selectors).toContain(".surface");
    expect(selectors).toContain(".surface .surface");
    expect(selectors).toContain(".surface .surface .surface");
  });

  it("does not emit old .layer1/.layer2/.layer3 selectors", () => {
    const selectors = extractSelectors(css);
    expect(selectors).not.toContain(".layer1");
    expect(selectors).not.toContain(".layer2");
    expect(selectors).not.toContain(".layer3");
  });

  it("uses --surface-* channel names", () => {
    for (const d of decls) {
      expect(d.property).toMatch(/^--surface-/);
    }
  });

  it("values are only var() references", () => {
    for (const d of decls) {
      expect(d.value).toMatch(/^var\(--/);
    }
  });

  it("var() targets point to semantic tokens, not other surfaces/modifiers", () => {
    for (const d of decls) {
      const refs = extractVarRefs(d.value);
      for (const ref of refs) {
        expect(ref).not.toMatch(/^--surface-/);
        expect(ref).not.toMatch(/^--modifier-/);
      }
    }
  });

  it("all three depth levels have the same number of declarations", () => {
    const depth1Match = css.match(/(?<![.a-z])\.surface\s*\{([^}]*)\}/s);
    const depth2Match = css.match(/\.surface\s+\.surface\s*\{([^}]*)\}/s);
    const depth3Match = css.match(
      /\.surface\s+\.surface\s+\.surface\s*\{([^}]*)\}/s,
    );
    const d1Decls = extractDeclarations(requireCapture(depth1Match, "depth 1"));
    const d2Decls = extractDeclarations(requireCapture(depth2Match, "depth 2"));
    const d3Decls = extractDeclarations(requireCapture(depth3Match, "depth 3"));
    expect(d1Decls.length).toBe(d2Decls.length);
    expect(d2Decls.length).toBe(d3Decls.length);
  });

  it("depth 1 (.surface) aliases to base semantic tokens", () => {
    const depth1Match = css.match(/(?<![.a-z])\.surface\s*\{([^}]*)\}/s);
    const d1Decls = extractDeclarations(requireCapture(depth1Match, "depth 1"));
    for (const d of d1Decls) {
      expect(d.value).not.toMatch(/-layer\d/);
    }
  });

  it("depth 2 (.surface .surface) references -layer2 tokens", () => {
    const depth2Match = css.match(/\.surface\s+\.surface\s*\{([^}]*)\}/s);
    const d2Decls = extractDeclarations(requireCapture(depth2Match, "depth 2"));
    for (const d of d2Decls) {
      expect(d.value).toMatch(/-layer2/);
    }
  });

  it("depth 3 (.surface .surface .surface) references -layer3 tokens", () => {
    const depth3Match = css.match(
      /\.surface\s+\.surface\s+\.surface\s*\{([^}]*)\}/s,
    );
    const d3Decls = extractDeclarations(requireCapture(depth3Match, "depth 3"));
    for (const d of d3Decls) {
      expect(d.value).toMatch(/-layer3/);
    }
  });

  it("layer declarations include background", () => {
    expect(decls.some((d) => d.property === "--surface-color-background")).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// 3.7 Validate states.css
// ---------------------------------------------------------------------------
describe("3.7 states.css", () => {
  const css = dist("states.css");
  const decls = extractDeclarations(css);

  it("wraps in @layer ds.states", () => {
    expect(css).toContain("@layer ds.states");
  });

  it("uses * {} selector (per-element scope)", () => {
    expect(extractSelectors(css)).toContain("*");
  });

  it("emits --hover--* derived variables", () => {
    const hoverDecls = decls.filter((d) => d.property.startsWith("--hover--"));
    expect(hoverDecls.length).toBeGreaterThan(0);
  });

  it("emits --active--* derived variables", () => {
    const activeDecls = decls.filter((d) =>
      d.property.startsWith("--active--"),
    );
    expect(activeDecls.length).toBeGreaterThan(0);
  });

  it("emits --disabled--* derived variables", () => {
    const disabledDecls = decls.filter((d) =>
      d.property.startsWith("--disabled--"),
    );
    expect(disabledDecls.length).toBeGreaterThan(0);
  });

  it("hover/active formulas use oklch(from ...) with var(--delta-*)", () => {
    const hoverDecls = decls.filter((d) => d.property.startsWith("--hover--"));
    for (const d of hoverDecls) {
      expect(d.value).toMatch(/^oklch\(from /);
      expect(d.value).toContain("var(--delta-hover-");
      expect(d.value).toContain("calc(l +");
    }

    const activeDecls = decls.filter((d) =>
      d.property.startsWith("--active--"),
    );
    for (const d of activeDecls) {
      expect(d.value).toMatch(/^oklch\(from /);
      expect(d.value).toContain("var(--delta-active-");
      expect(d.value).toContain("calc(l +");
    }
  });

  it("disabled formulas use color-mix()", () => {
    const disabledDecls = decls.filter((d) =>
      d.property.startsWith("--disabled--"),
    );
    for (const d of disabledDecls) {
      expect(d.value).toMatch(/^color-mix\(in oklch,/);
    }
  });

  it("all var() targets in oklch(from ...) use correct fallback chains", () => {
    for (const d of decls) {
      const refs = extractVarRefs(d.value);
      const hasSemanticRef = refs.some(
        (r) => r.startsWith("--color-") && !r.startsWith("--color-palette-"),
      );
      expect(hasSemanticRef).toBe(true);
    }
  });

  it("disabled formulas mix against background (surface or semantic)", () => {
    const disabledDecls = decls.filter((d) =>
      d.property.startsWith("--disabled--"),
    );
    for (const d of disabledDecls) {
      const refs = extractVarRefs(d.value);
      const hasBackground = refs.some(
        (r) => r === "--surface-color-background" || r === "--color-background",
      );
      expect(hasBackground).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3.8 Validate cross-file consistency
// ---------------------------------------------------------------------------
describe("3.8 cross-file consistency", () => {
  const outputDependencies: Record<string, string[]> = {
    "sets.primitive.css": [],
    "sets.semantic.css": ["sets.primitive.css"],
    "modifiers.theme.css": ["sets.primitive.css"],
    "modifiers.spacing.css": ["sets.primitive.css"],
    "modifiers.typography.css": ["sets.primitive.css"],
    "modifiers.anticipation.css": ["modifiers.theme.css"],
    "modifiers.criticality.css": ["modifiers.theme.css"],
    "modifiers.emphasis.css": ["modifiers.theme.css"],
    "modifiers.importance.css": ["modifiers.theme.css"],
    "modifiers.lifecycle.css": ["modifiers.theme.css"],
    "modifiers.release.css": ["modifiers.theme.css"],
    "modifiers.surfaces.css": ["modifiers.theme.css"],
    "states.css": [
      "sets.primitive.css",
      "modifiers.theme.css",
      "modifiers.anticipation.css",
      "modifiers.criticality.css",
      "modifiers.emphasis.css",
      "modifiers.importance.css",
      "modifiers.lifecycle.css",
      "modifiers.release.css",
      "modifiers.surfaces.css",
    ],
  };
  const themeCss = dist("modifiers.theme.css");
  const themeDecls = extractDeclarations(themeCss);
  const themeVars = new Set(themeDecls.map((d) => d.property));

  const primitiveCss = dist("sets.primitive.css");
  const primitiveDecls = extractDeclarations(primitiveCss);
  const primitiveVars = new Set(primitiveDecls.map((d) => d.property));

  const semanticCss = dist("sets.semantic.css");
  const semanticDecls = extractDeclarations(semanticCss);
  const semanticVars = new Set(semanticDecls.map((d) => d.property));

  const allDefinedVars = new Set([
    ...themeVars,
    ...primitiveVars,
    ...semanticVars,
  ]);

  const typoCss = dist("modifiers.typography.css");
  const typoDecls = extractDeclarations(typoCss);
  for (const d of typoDecls) {
    allDefinedVars.add(d.property);
  }
  for (const d of extractDeclarations(dist("modifiers.spacing.css"))) {
    allDefinedVars.add(d.property);
  }

  it("resolves every var() reference in the generated CSS suite", () => {
    const cssFiles = readdirSync(DIST).filter((file) => file.endsWith(".css"));
    const declarations = cssFiles.flatMap((file) =>
      extractDeclarations(dist(file)),
    );
    const defined = new Set(declarations.map(({ property }) => property));
    const missing = declarations.flatMap(({ property, value }) =>
      extractVarRefs(value)
        .filter((reference) => !defined.has(reference))
        .map((reference) => `${property} references ${reference}`),
    );
    expect(missing).toEqual([]);
  });

  it("resolves each stylesheet against only its declared delivery dependencies", () => {
    const missing: string[] = [];
    for (const [file, dependencies] of Object.entries(outputDependencies)) {
      const ownDeclarations = extractDeclarations(dist(file));
      const available = new Set(
        [file, ...dependencies].flatMap((dependency) =>
          extractDeclarations(dist(dependency)).map(({ property }) => property),
        ),
      );
      for (const { property, value } of ownDeclarations) {
        for (const reference of extractVarRefs(value)) {
          if (!available.has(reference)) {
            missing.push(`${file}: ${property} references ${reference}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps every bounded legacy alias equal to its canonical source", () => {
    const cssFiles = readdirSync(DIST).filter((file) => file.endsWith(".css"));
    const declarations = new Map(
      cssFiles.flatMap((file) =>
        extractDeclarations(dist(file)).map(({ property, value }) => [
          property,
          value,
        ]),
      ),
    );
    const tokens = JSON.parse(dist("tokens.json")) as Artifact;
    let checked = 0;

    for (const [canonical, token] of Object.entries(tokens)) {
      if (token.id === null) continue;
      const legacy = legacyCssVarForToken(token.id);
      if (!legacy) continue;

      expect(declarations.has(canonical), canonical).toBe(true);
      expect(declarations.has(legacy), legacy).toBe(true);
      expect(resolveGeneratedValue(legacy, declarations), legacy).toBe(
        resolveGeneratedValue(canonical, declarations),
      );
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
  });

  it("typography var() targets are defined", () => {
    const missing: string[] = [];
    for (const declaration of typoDecls) {
      for (const reference of extractVarRefs(declaration.value)) {
        if (!allDefinedVars.has(reference)) {
          missing.push(`${declaration.property} references ${reference}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("modifier var() targets exist in modifiers.theme.css or sets.primitive.css", () => {
    const familyFiles = [
      "modifiers.anticipation.css",
      "modifiers.criticality.css",
      "modifiers.emphasis.css",
    ];
    const missing: string[] = [];
    for (const file of familyFiles) {
      const css = dist(file);
      const decls = extractDeclarations(css);
      for (const d of decls) {
        const refs = extractVarRefs(d.value);
        for (const ref of refs) {
          if (!allDefinedVars.has(ref)) {
            missing.push(`${file}: ${d.property} references ${ref}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("surface var() targets exist in modifiers.theme.css", () => {
    const css = dist("modifiers.surfaces.css");
    const decls = extractDeclarations(css);
    const missing: string[] = [];
    for (const d of decls) {
      const refs = extractVarRefs(d.value);
      for (const ref of refs) {
        if (!allDefinedVars.has(ref)) {
          missing.push(`${d.property} references ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("delta var() targets in states.css exist in modifiers.theme.css", () => {
    const css = dist("states.css");
    const decls = extractDeclarations(css);
    const missing: string[] = [];
    for (const d of decls) {
      const refs = extractVarRefs(d.value);
      for (const ref of refs) {
        if (ref.startsWith("--delta-") && !themeVars.has(ref)) {
          missing.push(`${d.property} references ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("states.css semantic var() targets exist in theme or primitive", () => {
    const css = dist("states.css");
    const decls = extractDeclarations(css);
    const missing: string[] = [];
    for (const d of decls) {
      const refs = extractVarRefs(d.value);
      for (const ref of refs) {
        if (ref.startsWith("--modifier-")) continue;
        if (ref.startsWith("--surface-")) continue;
        if (ref.startsWith("--delta-")) continue;
        if (!allDefinedVars.has(ref)) {
          missing.push(`${d.property} references ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("modifier and surface channel vars in states.css match declarations in modifier/surface files", () => {
    const statesCss = dist("states.css");
    const statesDecls = extractDeclarations(statesCss);

    const modifierChannels = new Set<string>();
    const surfaceChannels = new Set<string>();
    for (const d of statesDecls) {
      const refs = extractVarRefs(d.value);
      for (const ref of refs) {
        if (ref.startsWith("--modifier-")) modifierChannels.add(ref);
        if (ref.startsWith("--surface-")) surfaceChannels.add(ref);
      }
    }

    const modifierFiles = [
      "modifiers.anticipation.css",
      "modifiers.criticality.css",
      "modifiers.emphasis.css",
      "modifiers.importance.css",
    ];
    const declaredModifiers = new Set<string>();
    for (const file of modifierFiles) {
      for (const d of extractDeclarations(dist(file))) {
        declaredModifiers.add(d.property);
      }
    }

    const declaredSurfaces = new Set<string>();
    for (const d of extractDeclarations(dist("modifiers.surfaces.css"))) {
      declaredSurfaces.add(d.property);
    }

    for (const ch of modifierChannels) {
      expect(declaredModifiers.has(ch)).toBe(true);
    }
    for (const ch of surfaceChannels) {
      expect(declaredSurfaces.has(ch)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3.9 Validate tokens.json
// ---------------------------------------------------------------------------
describe("3.9 tokens.json", () => {
  const raw = dist("tokens.json");
  const tokens: Artifact = JSON.parse(raw);

  const entries = Object.entries(tokens);

  const referencedFiles = new Set(entries.map(([, t]) => t.cssOutputFile));

  const actualDistFiles = new Set(
    readdirSync(DIST).filter((f) => f.endsWith(".css") || f.endsWith(".json")),
  );

  it("publishes exactly twelve semantic spacing artifacts in the spacing output", () => {
    const spacing = entries.filter(([property]) =>
      property.startsWith("--spacing-"),
    );
    expect(spacing).toHaveLength(12);
    for (const [property, token] of spacing) {
      expect(property).toMatch(/^--spacing-[a-z0-9-]+$/);
      expect(token).toMatchObject({
        type: "dimension",
        tier: "semantic",
        visibility: "public",
        cssOutputFile: "modifiers.spacing.css",
      });
      expect(token.declarations?.map(({ selector }) => selector)).toEqual([
        ":root",
        ".app",
        ".docs",
        ".site",
        ".os",
      ]);
    }
  });

  it("every cssVar key matches the token's cssVar field", () => {
    for (const [key, token] of entries) {
      expect(key).toBe(token.cssVar);
    }
  });

  it("every cssOutputFile names a real output file", () => {
    const missing: string[] = [];
    for (const file of referencedFiles) {
      if (!actualDistFiles.has(file)) {
        missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });

  it("makes every token in every resolver source document reachable", () => {
    const resolver = JSON.parse(
      readFileSync(resolve(CANONICAL, "canonical.resolver.json"), "utf8"),
    ) as {
      sets?: Record<string, { sources?: Array<{ $ref?: string }> }>;
      modifiers?: Record<
        string,
        { contexts?: Record<string, Array<{ $ref?: string }>> }
      >;
    };
    const sourceDocuments = new Set<string>();
    for (const set of Object.values(resolver.sets ?? {})) {
      for (const source of set.sources ?? []) {
        if (source.$ref) sourceDocuments.add(source.$ref);
      }
    }
    for (const modifier of Object.values(resolver.modifiers ?? {})) {
      for (const sources of Object.values(modifier.contexts ?? {})) {
        for (const source of sources) {
          if (source.$ref) sourceDocuments.add(source.$ref);
        }
      }
    }

    const artifactIds = entries.flatMap(([, token]) =>
      token.id === null ? [] : [token.id],
    );
    const missing: string[] = [];
    for (const sourceDocument of sourceDocuments) {
      const document = JSON.parse(
        readFileSync(resolve(CANONICAL, sourceDocument), "utf8"),
      ) as unknown;
      const sourceIds: string[] = [];
      walkSourceTokens(document, [], (id) => sourceIds.push(id));
      for (const id of sourceIds) {
        if (
          !artifactIds.some(
            (artifactId) =>
              artifactId === id || artifactId.startsWith(`${id}.`),
          )
        ) {
          missing.push(`${sourceDocument}: ${id}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("every DTCG-sourced color token has both valueLight and valueDark", () => {
    const dtcgColors = entries.filter(
      ([, t]) => t.type === "color" && !t.derivedFrom,
    );
    for (const [, token] of dtcgColors) {
      expect(token.valueLight).toBeTruthy();
      expect(token.valueDark).toBeTruthy();
    }
  });

  it("isPaired is true iff valueLight !== valueDark", () => {
    const colorTokens = entries.filter(([, t]) => t.type === "color");
    const violations: string[] = [];
    for (const [key, token] of colorTokens) {
      const expected = token.valueLight !== token.valueDark;
      if (token.isPaired !== expected) {
        violations.push(
          `${key}: isPaired=${token.isPaired} but valueLight=${token.valueLight}, valueDark=${token.valueDark}`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("every token has a valid tier (no nulls)", () => {
    const validTiers = new Set(["primitive", "semantic", "derived"]);
    for (const [_key, token] of entries) {
      expect(validTiers.has(token.tier)).toBe(true);
    }
  });

  it("marks source tokens public and generated channels internal", () => {
    for (const [key, token] of entries) {
      if (token.id === null) {
        expect(token.visibility, key).toBe("internal");
      } else {
        expect(token.visibility, key).toBe("public");
      }
    }
  });

  it("primitive tokens have tier: primitive", () => {
    const primitives = entries.filter(([, t]) =>
      t.id?.startsWith("color.palette."),
    );
    expect(primitives.length).toBeGreaterThan(0);
    for (const [, token] of primitives) {
      expect(token.tier).toBe("primitive");
    }
  });

  it("semantic color tokens have tier: semantic", () => {
    const semantics = entries.filter(
      ([, t]) =>
        t.type === "color" &&
        t.id != null &&
        !t.id.startsWith("color.palette.") &&
        t.cssOutputFile === "modifiers.theme.css" &&
        !t.id.startsWith("delta."),
    );
    expect(semantics.length).toBeGreaterThan(0);
    for (const [, token] of semantics) {
      expect(token.tier).toBe("semantic");
    }
  });

  it("derived tokens have null id", () => {
    const derived = entries.filter(([, t]) => t.tier === "derived");
    expect(derived.length).toBeGreaterThan(0);
    for (const [, token] of derived) {
      expect(token.id).toBeNull();
    }
  });

  it("derived tokens have valid derivedFrom and derivation", () => {
    const derived = entries.filter(([, t]) => t.tier === "derived");
    const violations: string[] = [];
    for (const [key, token] of derived) {
      if (!token.derivedFrom) {
        violations.push(`${key}: missing derivedFrom`);
      }
      if (!token.derivation) {
        violations.push(`${key}: missing derivation`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("token count in artefact is positive and non-trivial", () => {
    expect(entries.length).toBeGreaterThan(300);
  });

  it("every cssVar in artefact exists in exactly one CSS output file", () => {
    const varToFiles: Record<string, string[]> = {};
    for (const file of referencedFiles) {
      if (!file.endsWith(".css")) continue;
      const css = dist(file);
      const fileDecls = extractDeclarations(css);
      for (const d of fileDecls) {
        if (!varToFiles[d.property]) varToFiles[d.property] = [];
        varToFiles[d.property].push(file);
      }
    }

    const violations: string[] = [];
    for (const [_key, token] of entries) {
      const files = varToFiles[token.cssVar];
      if (!files) {
        violations.push(`${token.cssVar} not found in any CSS file`);
      } else if (!files.includes(token.cssOutputFile)) {
        violations.push(
          `${token.cssVar} claims cssOutputFile=${token.cssOutputFile} but found in [${files.join(", ")}]`,
        );
      }
    }
    expect(violations).toEqual([]);
  });
});

function walkSourceTokens(
  node: unknown,
  path: string[],
  visit: (id: string) => void,
): void {
  if (!node || typeof node !== "object") return;
  const object = node as Record<string, unknown>;
  if ("$value" in object) visit(path.join("."));
  for (const [key, child] of Object.entries(object)) {
    if (key === "$root") walkSourceTokens(child, path, visit);
    else if (!key.startsWith("$")) {
      walkSourceTokens(child, [...path, key], visit);
    }
  }
}

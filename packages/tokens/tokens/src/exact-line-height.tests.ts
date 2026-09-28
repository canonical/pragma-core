import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CANONICAL = join(import.meta.dirname, "../tokens/canonical");
const TYPOGRAPHY_DIR = join(CANONICAL, "global/semantic/modifier/typography");
const EXCEPTIONS = join(
  import.meta.dirname,
  "../contracts/lineHeightExceptions.json",
);

type JsonObject = Record<string, unknown>;
type Dimension = { value: number; unit: string };

const readJson = (path: string): JsonObject =>
  JSON.parse(readFileSync(path, "utf8")) as JsonObject;

const dimensions = readJson(
  join(CANONICAL, "global/primitive/dimension.tokens.json"),
) as {
  dimension: {
    [key: string]: { $value?: Dimension } | unknown;
    size: { fontSize: Record<string, { $value: Dimension }> };
  };
};
const numbers = readJson(
  join(CANONICAL, "global/primitive/number.tokens.json"),
) as {
  number: { lineHeight: Record<string, { $value: number }> };
};

const typographyDocuments = [
  "global.tokens.json",
  "apps.tokens.json",
  "docs.tokens.json",
  "sites.tokens.json",
].map((file) => [file, readJson(join(TYPOGRAPHY_DIR, file))] as const);

function aliasLeaf(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a token alias`);
  }
  const match = pattern.exec(value);
  if (!match?.[1]) throw new Error(`${label} has unexpected alias ${value}`);
  return match[1];
}

function collectDirectTypographyRoots(
  node: unknown,
  path: string[],
  roots: Array<{ label: string; token: JsonObject }>,
): void {
  if (!node || typeof node !== "object") return;
  const object = node as JsonObject;
  const value = object.$value;
  if (
    value &&
    typeof value === "object" &&
    typeof (value as JsonObject).fontSize === "string" &&
    typeof (value as JsonObject).lineHeight === "string"
  ) {
    roots.push({ label: path.join("."), token: object });
  }
  for (const [key, child] of Object.entries(object)) {
    if (key === "$root") collectDirectTypographyRoots(child, path, roots);
    else if (!key.startsWith("$")) {
      collectDirectTypographyRoots(child, [...path, key], roots);
    }
  }
}

describe("exact typography line-height projections", () => {
  it("keeps every numeric projection within 0.01px of its exact dimension", () => {
    const checked: string[] = [];

    for (const [file, document] of typographyDocuments) {
      const roots: Array<{ label: string; token: JsonObject }> = [];
      collectDirectTypographyRoots(document, [], roots);
      for (const { label, token } of roots) {
        const value = token.$value as JsonObject;
        const extension = token.$extensions as {
          "com.canonical.typography"?: {
            $value?: { lineHeightDimension?: { $ref?: string } };
          };
        };
        const exactRef =
          extension["com.canonical.typography"]?.$value?.lineHeightDimension
            ?.$ref;
        const fontSizeKey = aliasLeaf(
          value.fontSize,
          /^\{dimension\.size\.fontSize\.([^.}]+)\}$/,
          `${file}:${label}.fontSize`,
        );
        const lineHeightKey = aliasLeaf(
          value.lineHeight,
          /^\{number\.lineHeight\.([^.}]+)\}$/,
          `${file}:${label}.lineHeight`,
        );
        const exactKey = aliasLeaf(
          exactRef,
          /^#\/dimension\/([^/]+)\/\$value$/,
          `${file}:${label}.lineHeightDimension`,
        );

        const fontSize = dimensions.dimension.size.fontSize[fontSizeKey].$value;
        const projection = numbers.number.lineHeight[lineHeightKey].$value;
        const exact = (dimensions.dimension[exactKey] as { $value: Dimension })
          .$value;
        expect(fontSize.unit, `${file}:${label}`).toBe("rem");
        expect(exact.unit, `${file}:${label}`).toBe("rem");
        expect(
          Math.abs(fontSize.value * 16 * projection - exact.value * 16),
          `${file}:${label}`,
        ).toBeLessThanOrEqual(0.01);
        checked.push(`${file}:${label}`);
      }
    }

    expect(checked.length).toBeGreaterThan(0);
  });

  it("manifests only the inherited Site 14px/20px secondary family", () => {
    const manifest = readJson(EXCEPTIONS) as {
      lineHeightExceptions: Array<{
        product: string;
        rootRole: string;
        members: string[];
        baselineCount: { numerator: number; denominator: number };
        reason: string;
        visualEvidence: { singleLine: string; multiline: string };
      }>;
    };

    expect(manifest.lineHeightExceptions).toHaveLength(1);
    expect(manifest.lineHeightExceptions[0]).toMatchObject({
      product: "site",
      rootRole: "typography.text.secondary",
      members: [
        "typography.text.secondary",
        "typography.text.secondary.bold",
        "typography.text.secondary.code",
        "typography.text.secondary.prose",
        "typography.text.secondary.prose.bold",
      ],
      baselineCount: { numerator: 5, denominator: 2 },
    });
    expect(manifest.lineHeightExceptions[0].reason).not.toBe("");
    expect(
      manifest.lineHeightExceptions[0].visualEvidence.singleLine,
    ).toContain("half-phase");
    expect(manifest.lineHeightExceptions[0].visualEvidence.multiline).toContain(
      "alternate",
    );
  });
});

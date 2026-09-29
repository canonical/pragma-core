/**
 * Canonical typography `$extensions` → CSS sub-properties.
 *
 * Composite typography tokens carry two properties that the W3C DTCG spec does
 * not model, so they live under
 * `$extensions.com.canonical.typography.$value`:
 *
 *   letterCase   → CSS `font-variant`         (e.g. small-caps)
 *   figureStyle         → CSS `font-variant-numeric` (e.g. oldstyle-nums)
 *   lineHeightDimension → exact CSS `line-height-dimension` length
 *
 * Terrazzo's `transformCSSValue` only flattens the standard `$value`
 * sub-keys (fontFamily, fontSize, …), so without this the extension is dropped
 * and a token authored as small-caps (heading-5, text-primary-smallcaps, …)
 * emits no `font-variant`. This helper reads the extension and returns the
 * extra `{ suffix: cssValue }` entries to merge into the transform value map, so
 * `emitTypographyDecls` emits them alongside the other sub-properties.
 *
 * The extension values are stored as `$ref` pointers to the letterCase /
 * figureStyle PRIMITIVES, which are classified into a separate set and are not
 * reachable from the typography transform. Since those primitives are a fixed,
 * closed vocabulary (see global/primitive/typography.tokens.json), the ref's
 * leaf name is mapped to its CSS value here rather than dereferenced. The
 * `default` / `normal` cases are omitted: they equal the CSS initial value, so
 * emitting them would only add noise (and override an inherited variant).
 */

import { convertTokenIdToCssVar } from "../naming.js";

/**
 * Maps a `{ $ref }` extension entry to the primitive leaf name it points at.
 * The resolved extension stores each property as a `$ref` OBJECT pointing at the
 * letterCase / figureStyle primitive, e.g.
 * `{ $ref: "#/typography/letterCase/smallcaps/$extensions/…/$value" }` → `smallcaps`.
 */
function refLeaf(entry: unknown): string | undefined {
  const ref =
    entry && typeof entry === "object" && "$ref" in entry
      ? (entry as { $ref?: unknown }).$ref
      : entry;
  if (typeof ref !== "string") return undefined;
  const match = ref.match(
    /\/(?:letterCase|figureStyle)\/([^/]+)\/\$extensions\//,
  );
  return match?.[1];
}

function exactLineHeight(entry: unknown): string | undefined {
  if (typeof entry === "string") {
    const alias = /^\{(.+)\}$/.exec(entry);
    if (alias) return `var(${convertTokenIdToCssVar(alias[1])})`;
    return entry;
  }
  if (!entry || typeof entry !== "object") return undefined;
  if ("$ref" in entry) {
    const ref = (entry as { $ref?: unknown }).$ref;
    if (typeof ref !== "string") return undefined;
    const match = /^#\/(dimension(?:\/[^/]+)+)\/\$value$/.exec(ref);
    if (match)
      return `var(${convertTokenIdToCssVar(match[1].replaceAll("/", "."))})`;
    return undefined;
  }
  if ("value" in entry && "unit" in entry) {
    const dimension = entry as { value?: unknown; unit?: unknown };
    if (
      typeof dimension.value === "number" &&
      typeof dimension.unit === "string"
    ) {
      return `${dimension.value}${dimension.unit}`;
    }
  }
  return undefined;
}

/** letterCase primitive leaf → CSS `font-variant` value. `default`/`normal` omitted. */
const LETTER_CASE_CSS: Record<string, string> = {
  smallcaps: "small-caps",
};

/** figureStyle primitive leaf → CSS `font-variant-numeric` value. */
const FIGURE_STYLE_CSS: Record<string, string> = {
  oldStyleFigure: "oldstyle-nums",
  liningFigures: "lining-nums",
};

/**
 * Extra typography sub-properties from a token's canonical `$extensions`.
 * Returns `{}` when the token has no extension or only default/normal values.
 */
export function typographyExtensionDecls(
  $extensions: Record<string, unknown> | undefined,
): Record<string, string> {
  const ext = $extensions?.["com.canonical.typography"] as
    | {
        $value?: {
          letterCase?: unknown;
          figureStyle?: unknown;
          lineHeightDimension?: unknown;
        };
      }
    | undefined;
  const extValue = ext?.$value;
  if (!extValue) return {};

  const out: Record<string, string> = {};

  const lineHeight = exactLineHeight(extValue.lineHeightDimension);
  if (lineHeight) out["line-height-dimension"] = lineHeight;

  const letterCase = LETTER_CASE_CSS[refLeaf(extValue.letterCase) ?? ""];
  if (letterCase) out["font-variant"] = letterCase;

  const figureStyle = FIGURE_STYLE_CSS[refLeaf(extValue.figureStyle) ?? ""];
  if (figureStyle) out["font-variant-numeric"] = figureStyle;

  return out;
}

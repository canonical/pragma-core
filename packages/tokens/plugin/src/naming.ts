/**
 * Convert a DTCG token ID to a CSS custom property name.
 *
 * Rules:
 * 1. Strip the `.$root` terminal if present
 * 2. Convert each identifier segment to lowercase kebab-case
 * 3. Replace every `.` with `-`
 * 4. Prepend `--`
 *
 * @example convertTokenIdToCssVar("color.foreground.primary.$root") => "--color-foreground-primary"
 * @example convertTokenIdToCssVar("typography.heading.1.fontSize") => "--typography-heading-1-font-size"
 */
export function convertTokenIdToCssVar(id: string): string {
  let name = id;
  // Strip terminal .$root (only when it is the last segment)
  if (name.endsWith(".$root")) {
    name = name.slice(0, -6);
  }
  return `--${name.split(".").map(toKebabSegment).join("-")}`;
}

/**
 * The pre-1.0 transform only replaced dots, leaving camelCase inside segments.
 * Builders use this solely to emit bounded CSS aliases while consumers move to
 * the canonical lowercase-kebab names.
 */
export function convertLegacyTokenIdToCssVar(id: string): string {
  const name = id.endsWith(".$root") ? id.slice(0, -6) : id;
  return `--${name.replaceAll(".", "-")}`;
}

/** Return the legacy property only when the canonical spelling changed. */
export function legacyCssVarForToken(id: string): string | undefined {
  const canonical = convertTokenIdToCssVar(id);
  const legacy = convertLegacyTokenIdToCssVar(id);
  return canonical === legacy ? undefined : legacy;
}

/** Fail before output when two source IDs collapse to one CSS property. */
export function assertUniqueCssVarNames(ids: Iterable<string>): void {
  const ownerByCssVar = new Map<string, string>();
  for (const id of ids) {
    const cssVar = convertTokenIdToCssVar(id);
    const owner = ownerByCssVar.get(cssVar);
    if (owner !== undefined && owner !== id) {
      throw new Error(
        `[canonical-css] CSS property collision: ${owner} and ${id} both emit ${cssVar}`,
      );
    }
    ownerByCssVar.set(cssVar, id);
  }
}

function toKebabSegment(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Add a channel prefix to a CSS variable name.
 *
 * @example prefixVar("--color-foreground-primary", "modifier") => "--modifier-color-foreground-primary"
 */
export function prefixVar(cssVar: string, prefix: string): string {
  return `--${prefix}-${cssVar.slice(2)}`;
}

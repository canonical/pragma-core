/**
 * The style value form and its grammar (ADR J §4.1, AT.01–AT.03).
 *
 * A value is a **symbol**, a **primitive**, or a **sequence** whose elements
 * are symbols with at most one primitive, and only as the last element. The
 * sequence is the fallback order: a one-to-one transcription of the
 * implementation's `var(a, var(b, …))` chain, terminal literal included,
 * because an implementation generated or checked from the anatomy has to be
 * able to write the whole chain from what the anatomy says.
 *
 * The grammar runs over the PARSED document — a scalar or a sequence of
 * scalars — and never over raw text. A value is classified by its SHAPE:
 * whether the author quoted a scalar decides nothing, because every outcome
 * quoting was for is already the shape's. A scalar that satisfies the symbol
 * grammar is a symbol however it was written (`"color.text"` is
 * `color.text`); one that satisfies no primitive form either is the ADR's
 * `Quoted` — any text, which is what a literal tail holding a space or a
 * slash needs (`1 / -1`, `*`).
 *
 * What is rejected is the notation this release retires: a slash path, the
 * trailing `?` marker, `$root`, and a primitive anywhere but last. Each is a
 * typed error naming the value and the rule.
 */

/** A symbol: the dotted spelling of a `dt:TokenSymbol`, verbatim. */
export const SYMBOL = /^[a-z]+(\.[A-Za-z0-9]+)+$/;

/**
 * A CSS keyword. The ADR's production is `[a-zA-Z]+`, which admits `flow`,
 * `currentColor`, `inherit`, `auto` and `normal` — and none of
 * `not-allowed`, `space-between`, `inline-flex`, `flex-start` or
 * `border-box`, which the reference implementations use throughout. So the
 * production is widened to the shape of a CSS keyword: hyphen-joined words.
 * The widening admits no symbol, since a symbol carries a dot and never a
 * hyphen.
 */
export const KEYWORD = /^[a-zA-Z]+(-[a-zA-Z]+)*$/;
export const NUMBER = /^-?[0-9]+(\.[0-9]+)?$/;
export const DIMENSION = /^-?[0-9]+(\.[0-9]+)?([a-z]+|%)$/;
export const COLOR = /^#[0-9a-fA-F]{3,8}$/;

/**
 * The retired path notation: slash-delimited segments, with or without the
 * optional marker. Anchored on the whole scalar, so a literal that merely
 * holds a slash between spaces (`1 / -1`, a grid line) is untouched — the
 * slash ban is on symbol spellings, never on literals.
 */
export const RETIRED_PATH = /^[A-Za-z0-9-]+(\/[A-Za-z0-9-]+)+\??$/;

/** The retired optional marker: a trailing `?` meaning "may be undefined". */
export const RETIRED_MARKER = /\?$/;

/** The retired root segment, in either spelling. */
export const RETIRED_ROOT = /(^|[./])\$?root([./]|$)/;

export type PrimitiveForm =
  | "keyword"
  | "number"
  | "dimension"
  | "color"
  | "quoted";

export type ValueElement =
  | { kind: "symbol"; text: string }
  | { kind: "primitive"; text: string; form: PrimitiveForm };

/** A parsed style value: its elements in fallback order, and how it reads. */
export interface StyleValue {
  elements: ValueElement[];
  /** True when the value was authored as a sequence. */
  list: boolean;
}

/** A value the grammar refuses, naming the value and the rule it broke. */
export class AnatomyValueError extends Error {
  constructor(
    readonly value: string,
    readonly rule: string,
    readonly key?: string,
  ) {
    super(
      `${key === undefined ? "style value" : `style value of ${key}`} ${JSON.stringify(value)} is rejected: ${rule}`,
    );
    this.name = "AnatomyValueError";
  }
}

/** The rules a value can break, as the errors name them. */
export const RULES = {
  slashPath:
    "the slash-delimited token path is retired — write the symbol's own dotted name",
  marker:
    "the trailing `?` marker is retired — an element that resolves nowhere is a register row and a comment, not a sigil",
  root: "`root` and `$root` are not value segments — the symbol is the dotted name without them",
  primitiveNotLast:
    "a primitive may only end a value: the sequence is the fallback order and a literal is what the chain ends in",
  singleton:
    "a sequence is a fallback order and needs two or more elements — write the scalar on its own",
  empty: "a value may not be empty",
  nested: "a value is a scalar or a sequence of scalars, never nested",
} as const;

function scalarText(raw: unknown, key?: string): string {
  if (raw === null || raw === undefined) {
    throw new AnatomyValueError(String(raw), RULES.empty, key);
  }
  if (typeof raw === "object") {
    throw new AnatomyValueError(JSON.stringify(raw), RULES.nested, key);
  }
  return String(raw);
}

/** Classify one scalar, rejecting the retired notation. */
export function classifyElement(raw: unknown, key?: string): ValueElement {
  const text = scalarText(raw, key);
  if (text === "") throw new AnatomyValueError(text, RULES.empty, key);
  if (RETIRED_PATH.test(text)) {
    throw new AnatomyValueError(text, RULES.slashPath, key);
  }
  if (RETIRED_MARKER.test(text)) {
    throw new AnatomyValueError(text, RULES.marker, key);
  }
  if (RETIRED_ROOT.test(text)) {
    throw new AnatomyValueError(text, RULES.root, key);
  }
  if (SYMBOL.test(text)) return { kind: "symbol", text };
  if (KEYWORD.test(text)) return { kind: "primitive", text, form: "keyword" };
  if (NUMBER.test(text)) return { kind: "primitive", text, form: "number" };
  if (DIMENSION.test(text)) {
    return { kind: "primitive", text, form: "dimension" };
  }
  if (COLOR.test(text)) return { kind: "primitive", text, form: "color" };
  // The ADR's `Quoted`: any text. A tail that holds a space or a slash, or
  // that a bare YAML would read as something else, is written quoted and
  // arrives here as itself.
  return { kind: "primitive", text, form: "quoted" };
}

/**
 * Parse a style value out of what the YAML parser holds for it: a scalar, or
 * a sequence of scalars.
 */
export function parseStyleValue(raw: unknown, key?: string): StyleValue {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new AnatomyValueError("[]", RULES.empty, key);
    }
    if (raw.length === 1) {
      throw new AnatomyValueError(authoredSpelling(raw), RULES.singleton, key);
    }
    const elements = raw.map((element) => classifyElement(element, key));
    for (const [i, element] of elements.entries()) {
      if (element.kind === "primitive" && i !== elements.length - 1) {
        throw new AnatomyValueError(element.text, RULES.primitiveNotLast, key);
      }
    }
    return { elements, list: true };
  }
  return { elements: [classifyElement(raw, key)], list: false };
}

/**
 * The authored spelling, kept verbatim on `anatomy:styleValue` as the
 * evidence of what the reference says: a scalar as it stands, a sequence in
 * its flow form.
 */
export function authoredSpelling(raw: unknown): string {
  if (Array.isArray(raw)) {
    return `[${raw.map((element) => String(element)).join(", ")}]`;
  }
  return String(raw);
}

/**
 * The symbols a value consumes, in fallback order — the one lift every
 * consumer shares (§4.1). A primitive is not a symbol: it resolves against
 * nothing by design, so it is neither lifted here nor asked to resolve.
 */
export function liftSymbols(raw: unknown, key?: string): string[] {
  return parseStyleValue(raw, key)
    .elements.filter((element) => element.kind === "symbol")
    .map((element) => element.text);
}

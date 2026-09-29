import type { LineHeightException } from "../plugin/types.js";
import { isSemanticTypography } from "./classification.js";
import {
  PRODUCT_CONTEXTS,
  productContexts,
  productInput,
  resolveProductAxis,
} from "./productAxis.js";
import resolveTypographyExtensions from "./resolveTypographyExtensions.js";
import type { ResolverLike } from "./shims.js";
import type { SourceCatalog } from "./sourceCatalog.js";

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

interface Dimension {
  value: number;
  unit: string;
}

/**
 * Enforce the product line-height lattice against exact dimensions.
 *
 * Whole baseline counts pass by default. A half count passes only for an exact
 * product/token pair in the reviewed manifest; every manifest member must be
 * encountered as that exact half count. No epsilon or runtime rounding is used.
 */
export function validateLineHeightLattice(
  resolver: ResolverLike,
  sourceCatalog: SourceCatalog | undefined,
  exceptions: readonly LineHeightException[] = [],
  requireProductBaseline = false,
): void {
  const defaultTokens = resolver.apply({});
  if (!("spacing.baseline" in defaultTokens)) {
    if (requireProductBaseline) {
      throw new Error(
        "[canonical-css] Missing required spacing.baseline in the default product context",
      );
    }
    return;
  }

  const allowed = validateManifest(exceptions);
  const seen = new Set<string>();
  const contexts = productContexts(resolver);

  if (requireProductBaseline) {
    const axis = resolveProductAxis(resolver);
    const declaredContexts = resolver.source?.modifiers?.[axis]?.contexts;
    const missing = PRODUCT_CONTEXTS.filter(
      (context) => !declaredContexts || !(context in declaredContexts),
    );
    if (missing.length > 0) {
      throw new Error(
        `[canonical-css] Missing required product contexts for spacing.baseline: ${missing.join(", ")}`,
      );
    }
  }

  // The emitted :root cascade uses the default permutation. Its spacing is
  // Site's default, so validate it with Site's narrowly scoped exceptions,
  // but do not let it satisfy exception coverage for the explicit .site set.
  validatePermutation("root", "site", {}, false);

  for (const product of contexts) {
    const input = productInput(resolver, product);
    validatePermutation(product, product, input, true);
  }

  const unused = [...allowed.keys()].filter((key) => !seen.has(key));
  if (unused.length > 0) {
    throw new Error(
      `[canonical-css] Line-height exception members were not resolved as half steps: ${unused.join(", ")}`,
    );
  }

  function validatePermutation(
    label: string,
    exceptionProduct: string,
    input: Record<string, string>,
    recordExceptions: boolean,
  ): void {
    const tokens = resolver.apply(input);
    const baseline = requireDimension(
      tokens["spacing.baseline"]?.$value,
      `${label}:spacing.baseline`,
    );
    const extensions = resolveTypographyExtensions(
      resolver,
      input,
      sourceCatalog,
    );

    for (const [id, token] of Object.entries(tokens)) {
      if (!isSemanticTypography(token, id, sourceCatalog)) continue;
      const lineHeight = requireLineHeightDimension(
        extensions[id],
        tokens,
        label,
        id,
      );
      if (lineHeight.unit !== baseline.unit) {
        throw new Error(
          `[canonical-css] Line-height lattice cannot compare ${label}:${id} (${lineHeight.unit}) with spacing.baseline (${baseline.unit})`,
        );
      }

      const count = divide(
        decimalFraction(lineHeight.value),
        decimalFraction(baseline.value),
      );
      const key = exceptionKey(exceptionProduct, id);
      const exception = allowed.get(key);

      if (isWhole(count)) {
        if (exception) {
          throw new Error(
            `[canonical-css] Stale line-height exception ${exceptionProduct}:${id}: ${formatFraction(count)} baselines is a whole count`,
          );
        }
        continue;
      }

      if (!isHalf(count)) {
        throw new Error(
          `[canonical-css] Invalid line-height lattice point ${label}:${id}: ${formatFraction(count)} baselines is neither whole nor an authorised half`,
        );
      }
      if (!exception) {
        throw new Error(
          `[canonical-css] Unauthorised half-step line height ${label}:${id}: ${formatFraction(count)} baselines`,
        );
      }

      const expected = normalize({
        numerator: BigInt(exception.baselineCount.numerator),
        denominator: BigInt(exception.baselineCount.denominator),
      });
      if (!equalFractions(count, expected)) {
        throw new Error(
          `[canonical-css] Line-height exception ${exceptionProduct}:${id} expects ${formatFraction(expected)} baselines but resolves to ${formatFraction(count)}`,
        );
      }
      if (recordExceptions) seen.add(key);
    }
  }
}

function validateManifest(
  exceptions: readonly LineHeightException[],
): Map<string, LineHeightException> {
  const allowed = new Map<string, LineHeightException>();
  for (const exception of exceptions) {
    if (
      !exception.product ||
      !exception.rootRole ||
      !exception.reason ||
      !exception.visualEvidence?.singleLine ||
      !exception.visualEvidence?.multiline
    ) {
      throw new Error(
        "[canonical-css] Every line-height exception requires product, rootRole, reason, and single/multiline visual evidence",
      );
    }
    if (!exception.members.includes(exception.rootRole)) {
      throw new Error(
        `[canonical-css] Line-height exception ${exception.product}:${exception.rootRole} must enumerate its root role`,
      );
    }
    if (
      !Number.isSafeInteger(exception.baselineCount.numerator) ||
      !Number.isSafeInteger(exception.baselineCount.denominator) ||
      exception.baselineCount.numerator <= 0 ||
      exception.baselineCount.denominator <= 0 ||
      exception.baselineCount.numerator %
        exception.baselineCount.denominator ===
        0 ||
      (exception.baselineCount.numerator * 2) %
        exception.baselineCount.denominator !==
        0
    ) {
      throw new Error(
        `[canonical-css] Line-height exception ${exception.product}:${exception.rootRole} must declare a positive non-whole half-integer baselineCount`,
      );
    }

    for (const member of exception.members) {
      const key = exceptionKey(exception.product, member);
      if (allowed.has(key)) {
        throw new Error(
          `[canonical-css] Duplicate line-height exception member ${exception.product}:${member}`,
        );
      }
      allowed.set(key, exception);
    }
  }
  return allowed;
}

function requireLineHeightDimension(
  extensions: Record<string, unknown> | undefined,
  tokens: ReturnType<ResolverLike["apply"]>,
  product: string,
  id: string,
): Dimension {
  const canonical = extensions?.["com.canonical.typography"] as
    | { $value?: { lineHeightDimension?: unknown } }
    | undefined;
  const entry = canonical?.$value?.lineHeightDimension;
  if (entry && typeof entry === "object" && "$ref" in entry) {
    const ref = (entry as { $ref?: unknown }).$ref;
    const match =
      typeof ref === "string"
        ? /^#\/(dimension(?:\/[^/]+)+)\/\$value$/.exec(ref)
        : null;
    if (match) {
      const targetId = match[1].replaceAll("/", ".");
      return requireDimension(
        tokens[targetId]?.$value,
        `${product}:${id}.lineHeightDimension -> ${targetId}`,
      );
    }
  }
  return requireDimension(entry, `${product}:${id}.lineHeightDimension`);
}

function requireDimension(value: unknown, label: string): Dimension {
  if (!value || typeof value !== "object") {
    throw new Error(`[canonical-css] Missing exact dimension at ${label}`);
  }
  const dimension = value as { value?: unknown; unit?: unknown };
  if (
    typeof dimension.value !== "number" ||
    !Number.isFinite(dimension.value) ||
    dimension.value <= 0 ||
    typeof dimension.unit !== "string" ||
    dimension.unit.length === 0
  ) {
    throw new Error(`[canonical-css] Invalid exact dimension at ${label}`);
  }
  return { value: dimension.value, unit: dimension.unit };
}

function decimalFraction(value: number): Fraction {
  const text = value.toString().toLowerCase();
  const [mantissa, exponentText] = text.split("e");
  const exponent = exponentText ? Number.parseInt(exponentText, 10) : 0;
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const [integer, fractional = ""] = unsigned.split(".");
  const digits = BigInt(`${integer}${fractional}` || "0");
  const scale = fractional.length - exponent;
  const numerator =
    (negative ? -digits : digits) * (scale < 0 ? 10n ** BigInt(-scale) : 1n);
  const denominator = scale > 0 ? 10n ** BigInt(scale) : 1n;
  return normalize({ numerator, denominator });
}

function divide(left: Fraction, right: Fraction): Fraction {
  return normalize({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

function normalize(value: Fraction): Fraction {
  const divisor = greatestCommonDivisor(
    value.numerator < 0n ? -value.numerator : value.numerator,
    value.denominator < 0n ? -value.denominator : value.denominator,
  );
  const sign = value.denominator < 0n ? -1n : 1n;
  return {
    numerator: (value.numerator / divisor) * sign,
    denominator: (value.denominator / divisor) * sign,
  };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

function isWhole(value: Fraction): boolean {
  return value.numerator % value.denominator === 0n;
}

function isHalf(value: Fraction): boolean {
  return (value.numerator * 2n) % value.denominator === 0n;
}

function equalFractions(left: Fraction, right: Fraction): boolean {
  return (
    left.numerator === right.numerator && left.denominator === right.denominator
  );
}

function formatFraction(value: Fraction): string {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator}/${value.denominator}`;
}

function exceptionKey(product: string, id: string): string {
  return `${product}:${id}`;
}

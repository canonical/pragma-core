import type { ResolverLike } from "./shims.js";

export const PRODUCT_CONTEXTS = ["app", "docs", "site", "os"] as const;

/**
 * Prefer the shared product axis. The typography name remains a bounded
 * read-only compatibility path for consumers still supplying the old resolver.
 */
export function resolveProductAxis(
  resolver: ResolverLike,
): "product" | "typography" {
  const modifiers = resolver.source?.modifiers;
  if (modifiers && "typography" in modifiers && !("product" in modifiers)) {
    return "typography";
  }
  return "product";
}

export function productInput(
  resolver: ResolverLike,
  context: string,
): Record<string, string> {
  return { [resolveProductAxis(resolver)]: context };
}

/** Only iterate contexts actually declared by a legacy or current resolver. */
export function productContexts(resolver: ResolverLike): string[] {
  const axis = resolveProductAxis(resolver);
  const contexts = resolver.source?.modifiers?.[axis]?.contexts;
  if (!contexts) return [...PRODUCT_CONTEXTS];
  return PRODUCT_CONTEXTS.filter((context) => context in contexts);
}

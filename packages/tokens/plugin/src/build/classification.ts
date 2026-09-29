/**
 * Token classification helpers.
 *
 * Classification follows the resolver source document, not the token ID.
 * A semantic `dimension.*` token must never be mistaken for a primitive just
 * because it shares a namespace with a primitive source file.
 */

import type { TokenLike } from "./shims.js";
import type { SourceCatalog } from "./sourceCatalog.js";

export type SourceRole = "primitive" | "semantic" | "unknown";

export function classifySourceRole(
  token: TokenLike | undefined,
  id?: string,
  catalog?: SourceCatalog,
): SourceRole {
  const catalogRole = id ? catalog?.get(id)?.role : undefined;
  if (catalogRole) return catalogRole;
  const filename = token?.source?.filename?.replaceAll("\\", "/").toLowerCase();
  if (!filename) return "unknown";
  if (filename.includes("/primitive/")) return "primitive";
  if (filename.includes("/semantic/")) return "semantic";
  return "unknown";
}

/** Token originates in a resolver primitive source document. */
export function isPrimitive(
  token: TokenLike | undefined,
  id?: string,
  catalog?: SourceCatalog,
): boolean {
  return classifySourceRole(token, id, catalog) === "primitive";
}

/** Colour token originating in a resolver semantic source document. */
export function isSemanticColor(
  token: TokenLike | undefined,
  id?: string,
  catalog?: SourceCatalog,
): boolean {
  return (
    classifySourceRole(token, id, catalog) === "semantic" &&
    token?.$type === "color"
  );
}

/** Typography token originating in a resolver semantic source document. */
export function isSemanticTypography(
  token: TokenLike | undefined,
  id?: string,
  catalog?: SourceCatalog,
): boolean {
  return (
    classifySourceRole(token, id, catalog) === "semantic" &&
    token?.$type === "typography"
  );
}

/** Dimension token in the public semantic spacing namespace. */
export function isSemanticSpacing(
  token: TokenLike | undefined,
  id?: string,
  catalog?: SourceCatalog,
): boolean {
  return (
    id?.startsWith("spacing.") === true &&
    classifySourceRole(token, id, catalog) === "semantic" &&
    token?.$type === "dimension"
  );
}

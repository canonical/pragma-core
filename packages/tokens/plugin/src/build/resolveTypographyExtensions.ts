import { isSemanticTypography } from "./classification.js";
import type { ResolverLike } from "./shims.js";
import type { SourceCatalog } from "./sourceCatalog.js";

/** Resolve Canonical typography extensions, including inherited exact leading. */
export default function resolveTypographyExtensions(
  resolver: ResolverLike,
  permutation: Record<string, string>,
  sourceCatalog?: SourceCatalog,
): Record<string, Record<string, unknown> | undefined> {
  const applied = resolver.apply(permutation);
  const out: Record<string, Record<string, unknown> | undefined> = {};
  for (const [id, token] of Object.entries(applied)) {
    if (isSemanticTypography(token, id, sourceCatalog)) {
      out[id] = token.$extensions;
    }
  }
  for (const id of Object.keys(out)) resolveExactLineHeight(id, out, new Set());
  return out;
}

function resolveExactLineHeight(
  id: string,
  extensionsById: Record<string, Record<string, unknown> | undefined>,
  visited: Set<string>,
): unknown {
  if (visited.has(id)) {
    throw new Error(`[canonical-css] Cyclic lineHeightDimension ref at ${id}`);
  }
  visited.add(id);

  const extensions = extensionsById[id];
  const canonical = extensions?.["com.canonical.typography"] as
    | { $value?: Record<string, unknown> }
    | undefined;
  const value = canonical?.$value;
  const entry = value?.lineHeightDimension;
  if (!entry || typeof entry !== "object" || !("$ref" in entry)) return entry;

  const ref = (entry as { $ref?: unknown }).$ref;
  if (typeof ref !== "string") return entry;
  const match =
    /^#\/(typography(?:\/[^/]+)+)\/\$extensions\/com\.canonical\.typography\/\$value\/lineHeightDimension$/.exec(
      ref,
    );
  if (!match) return entry;

  const targetId = match[1].replaceAll("/", ".").replace(/\.\$root$/, "");
  const resolved = resolveExactLineHeight(
    targetId,
    extensionsById,
    new Set(visited),
  );
  if (resolved !== undefined && value) value.lineHeightDimension = resolved;
  return resolved;
}

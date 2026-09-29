import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceRole } from "./classification.js";

export interface SourceCatalogEntry {
  role: Exclude<SourceRole, "unknown">;
  sourceFile: string;
}

export interface SourceCatalog {
  get(id: string): SourceCatalogEntry | undefined;
  ids?(): IterableIterator<string>;
}

/** Build token classification from the resolver's declared source documents. */
export function loadSourceCatalog(tokensDir: string): SourceCatalog {
  const entries = new Map<string, SourceCatalogEntry>();
  let resolver: Record<string, unknown>;
  try {
    resolver = JSON.parse(
      readFileSync(join(tokensDir, "canonical.resolver.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { get: (id) => entries.get(id), ids: () => entries.keys() };
    }
    throw error;
  }

  const sets = resolver.sets as
    | Record<string, { sources?: Array<{ $ref?: string }> }>
    | undefined;
  for (const [setName, set] of Object.entries(sets ?? {})) {
    const role = setName === "primitive" ? "primitive" : "semantic";
    for (const source of set.sources ?? []) {
      if (source.$ref) addDocument(source.$ref, role);
    }
  }

  const modifiers = resolver.modifiers as
    | Record<string, { contexts?: Record<string, Array<{ $ref?: string }>> }>
    | undefined;
  for (const modifier of Object.values(modifiers ?? {})) {
    for (const sources of Object.values(modifier.contexts ?? {})) {
      for (const source of sources) {
        if (source.$ref) addDocument(source.$ref, "semantic");
      }
    }
  }

  return { get: (id) => entries.get(id), ids: () => entries.keys() };

  function addDocument(
    relativePath: string,
    role: Exclude<SourceRole, "unknown">,
  ): void {
    const document = JSON.parse(
      readFileSync(join(tokensDir, relativePath), "utf8"),
    );
    walkTokens(document, [], (id) => {
      const current = entries.get(id);
      if (current && current.role !== role) {
        throw new Error(
          `[canonical-css] ${id} is declared as both ${current.role} (${current.sourceFile}) and ${role} (${relativePath})`,
        );
      }
      if (!current) entries.set(id, { role, sourceFile: relativePath });
    });
  }
}

export function walkTokens(
  node: unknown,
  path: string[],
  visit: (id: string) => void,
): void {
  if (!node || typeof node !== "object") return;
  const object = node as Record<string, unknown>;
  if ("$value" in object) visit(path.join("."));

  for (const [key, child] of Object.entries(object)) {
    if (key === "$root") walkTokens(child, path, visit);
    else if (!key.startsWith("$")) walkTokens(child, [...path, key], visit);
  }
}

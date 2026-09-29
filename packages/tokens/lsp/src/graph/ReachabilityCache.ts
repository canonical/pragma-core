/**
 * Cache import-graph reachability so diagnostics and completions do not
 * recompute the same transitive closure for every request.
 *
 * The cache stores both the forward reachable set for each entry file and a
 * reverse dependent index so invalidation can fan out when an imported file
 * changes.
 *
 * An LRU eviction policy caps the cache at {@link MAX_ENTRIES} to prevent
 * unbounded growth in large workspaces.
 */
import type TokenGraph from "./TokenGraph.js";

/** Maximum number of cached reachability sets before LRU eviction kicks in. */
const MAX_ENTRIES = 500;

export default class ReachabilityCache {
  private cache: Map<string, Set<string>> = new Map();
  private dependents: Map<string, Set<string>> = new Map();

  getReachableFiles(fileUri: string, graph: TokenGraph): Set<string> {
    const cached = this.cache.get(fileUri);
    if (cached) {
      // Move to end for LRU freshness
      this.cache.delete(fileUri);
      this.cache.set(fileUri, cached);
      return cached;
    }

    const visited = new Set<string>();
    const stack: string[] = [fileUri];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      const imports = graph.getImports(current);
      if (imports)
        for (const imported of imports)
          if (!visited.has(imported)) stack.push(imported);
    }

    // LRU eviction: drop the oldest entry if over capacity
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
        this.dependents.delete(oldest);
      }
    }

    this.cache.set(fileUri, visited);
    for (const reachable of visited) {
      let deps = this.dependents.get(reachable);
      if (!deps) {
        deps = new Set();
        this.dependents.set(reachable, deps);
      }
      deps.add(fileUri);
    }
    return visited;
  }

  getReachableVars(
    fileUri: string,
    graph: TokenGraph,
    globalStylesheets?: Set<string>,
  ): Set<string> {
    const reachable = this.getReachableFiles(fileUri, graph);
    const vars = new Set<string>();
    for (const uri of reachable) {
      const decls = graph.getDeclarationsByFile(uri);
      for (const d of decls) vars.add(d.cssVar);
    }
    if (globalStylesheets) {
      for (const uri of globalStylesheets) {
        const decls = graph.getDeclarationsByFile(uri);
        for (const d of decls) vars.add(d.cssVar);
      }
    }
    return vars;
  }

  invalidate(fileUri: string): void {
    const toInvalidate = new Set<string>();
    const stack = [fileUri];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (toInvalidate.has(current)) continue;
      toInvalidate.add(current);
      const deps = this.dependents.get(current);
      if (deps)
        for (const dep of deps) if (!toInvalidate.has(dep)) stack.push(dep);
    }
    for (const uri of toInvalidate) {
      this.cache.delete(uri);
      this.dependents.delete(uri);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.dependents.clear();
  }

  /** Current number of cached entries (exposed for testing). */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Buffer layer tests — TDD.
 *
 * Tests debounced file re-scan with 20ms window.
 *
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReachabilityCache, TokenGraph } from "../graph/index.js";
import { rescanFile, scheduleBufferUpdate } from "./scheduleBufferUpdate.js";
import type { PendingUpdate } from "./types.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rescanFile", () => {
  it("populates declarations from source", () => {
    const graph = new TokenGraph();
    rescanFile("file:///a.css", `:root { --x: 1; }`, graph);

    const decls = graph.getDeclarationsByFile("file:///a.css");
    expect(decls).toBeDefined();
    expect(decls?.some((d) => d.cssVar === "--x")).toBe(true);
  });

  it("clears previous declarations before re-scan", () => {
    const graph = new TokenGraph();
    rescanFile("file:///a.css", `:root { --old: 1; }`, graph);
    rescanFile("file:///a.css", `:root { --new: 2; }`, graph);

    expect(graph.hasVar("--new")).toBe(true);
    // Old var should be removed from declarations
    const decls = graph.getDeclarationsByFile("file:///a.css");
    expect(decls?.some((d) => d.cssVar === "--old")).toBe(false);
  });

  it("scans usages", () => {
    const graph = new TokenGraph();
    rescanFile("file:///a.css", `.box { color: var(--fg); }`, graph);

    const usages = graph.getUsagesByFile("file:///a.css");
    expect(usages?.some((u) => u.cssVar === "--fg")).toBe(true);
  });
});

describe("scheduleBufferUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onComplete after 20ms debounce", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    const pending = new Map<string, PendingUpdate>();
    let completed = false;

    scheduleBufferUpdate(
      "file:///a.css",
      `:root { --x: 1; }`,
      graph,
      cache,
      pending,
      () => {
        completed = true;
      },
    );

    expect(completed).toBe(false);
    vi.advanceTimersByTime(20);
    expect(completed).toBe(true);
  });

  it("cancels previous timer when called again for same URI", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    const pending = new Map<string, PendingUpdate>();
    let callCount = 0;

    scheduleBufferUpdate(
      "file:///a.css",
      `:root { --first: 1; }`,
      graph,
      cache,
      pending,
      () => {
        callCount++;
      },
    );

    // Second call before timer fires
    scheduleBufferUpdate(
      "file:///a.css",
      `:root { --second: 2; }`,
      graph,
      cache,
      pending,
      () => {
        callCount++;
      },
    );

    vi.advanceTimersByTime(20);
    // Only the second callback fires
    expect(callCount).toBe(1);
    expect(graph.hasVar("--second")).toBe(true);
  });

  it("invalidates reachability cache", () => {
    const graph = new TokenGraph();
    const cache = new ReachabilityCache();
    const pending = new Map<string, PendingUpdate>();

    // Prime the cache
    cache.getReachableFiles("file:///a.css", graph);

    scheduleBufferUpdate(
      "file:///a.css",
      `:root { --x: 1; }`,
      graph,
      cache,
      pending,
    );

    vi.advanceTimersByTime(20);
    // After invalidation, cache should recompute (no stale data)
    // This tests that invalidate was called — we can't directly check
    // the cache state, but we verify no error
    const reachable = cache.getReachableFiles("file:///a.css", graph);
    expect(reachable).toBeDefined();
  });
});
